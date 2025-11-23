use crate::models::K8sResourceType;
use async_trait::async_trait;
use kube::config::{KubeConfigOptions, Kubeconfig};
use kube::{Api, Client};
use std::error::Error;

#[cfg_attr(test, mockall::automock)]
#[async_trait]
pub trait K8sService: Send + Sync {
    async fn get_contexts(&self) -> Result<Vec<String>, Box<dyn Error + Send + Sync>>;
    async fn list_resources(
        &self,
        context_name: &str,
        resource_type: K8sResourceType,
    ) -> Result<Vec<serde_json::Value>, Box<dyn Error + Send + Sync>>;
    async fn get_resource(
        &self,
        context_name: &str,
        resource_type: K8sResourceType,
        name: &str,
        namespace: Option<String>,
    ) -> Result<serde_json::Value, Box<dyn Error + Send + Sync>>;
}

#[derive(Clone)]
pub struct K8sClient;

impl K8sClient {
    pub fn new() -> Self {
        Self {}
    }

    /// Helper to extract contexts from Kubeconfig, exposed for testing
    pub(crate) fn extract_contexts(config: Kubeconfig) -> Vec<String> {
        config.contexts.into_iter().map(|c| c.name).collect()
    }

    /// Helper to list resources using a provided client, exposed for testing
    pub(crate) async fn list_resources_with_client(
        client: Client,
        resource_type: K8sResourceType,
    ) -> Result<Vec<serde_json::Value>, Box<dyn Error + Send + Sync>> {
        let api_resource = resource_type.get_api_resource();
        let api: Api<kube::api::DynamicObject> = Api::all_with(client, &api_resource);

        let list = api
            .list(&Default::default())
            .await
            .map_err(|e| Box::new(e) as Box<dyn Error + Send + Sync>)?;

        Ok(list
            .items
            .into_iter()
            .map(|item| serde_json::to_value(item).unwrap_or_default())
            .collect())
    }

    /// Helper to get a single resource using a provided client, exposed for testing
    pub(crate) async fn get_resource_with_client(
        client: Client,
        resource_type: K8sResourceType,
        name: &str,
        namespace: Option<String>,
    ) -> Result<serde_json::Value, Box<dyn Error + Send + Sync>> {
        let api_resource = resource_type.get_api_resource();
        let api: Api<kube::api::DynamicObject> = if let Some(ns) = namespace {
            Api::namespaced_with(client, &ns, &api_resource)
        } else {
            Api::all_with(client, &api_resource)
        };

        let resource = api
            .get(name)
            .await
            .map_err(|e| Box::new(e) as Box<dyn Error + Send + Sync>)?;

        Ok(serde_json::to_value(resource).unwrap_or_default())
    }
}

#[async_trait]
impl K8sService for K8sClient {
    async fn get_contexts(&self) -> Result<Vec<String>, Box<dyn Error + Send + Sync>> {
        let kubeconfig: Kubeconfig =
            Kubeconfig::read().map_err(|e| Box::new(e) as Box<dyn Error + Send + Sync>)?;
        Ok(Self::extract_contexts(kubeconfig))
    }

    async fn list_resources(
        &self,
        context_name: &str,
        resource_type: K8sResourceType,
    ) -> Result<Vec<serde_json::Value>, Box<dyn Error + Send + Sync>> {
        let kubeconfig =
            Kubeconfig::read().map_err(|e| Box::new(e) as Box<dyn Error + Send + Sync>)?;
        let options = KubeConfigOptions {
            context: Some(context_name.to_string()),
            ..Default::default()
        };

        let config = kube::Config::from_custom_kubeconfig(kubeconfig, &options)
            .await
            .map_err(|e| Box::new(e) as Box<dyn Error + Send + Sync>)?;
        let client =
            Client::try_from(config).map_err(|e| Box::new(e) as Box<dyn Error + Send + Sync>)?;

        Self::list_resources_with_client(client, resource_type).await
    }

    async fn get_resource(
        &self,
        context_name: &str,
        resource_type: K8sResourceType,
        name: &str,
        namespace: Option<String>,
    ) -> Result<serde_json::Value, Box<dyn Error + Send + Sync>> {
        let kubeconfig =
            Kubeconfig::read().map_err(|e| Box::new(e) as Box<dyn Error + Send + Sync>)?;
        let options = KubeConfigOptions {
            context: Some(context_name.to_string()),
            ..Default::default()
        };

        let config = kube::Config::from_custom_kubeconfig(kubeconfig, &options)
            .await
            .map_err(|e| Box::new(e) as Box<dyn Error + Send + Sync>)?;
        let client =
            Client::try_from(config).map_err(|e| Box::new(e) as Box<dyn Error + Send + Sync>)?;

        Self::get_resource_with_client(client, resource_type, name, namespace).await
    }
}
