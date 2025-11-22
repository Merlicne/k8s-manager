use async_trait::async_trait;
use k8s_openapi::api::core::v1::Pod;
use kube::config::{KubeConfigOptions, Kubeconfig};
use kube::{Api, Client};
use std::error::Error;

#[cfg_attr(test, mockall::automock)]
#[async_trait]
pub trait K8sService: Send + Sync {
    async fn get_contexts(&self) -> Result<Vec<String>, Box<dyn Error + Send + Sync>>;
    async fn list_pods(&self, context_name: &str)
        -> Result<Vec<Pod>, Box<dyn Error + Send + Sync>>;
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

    /// Helper to list pods using a provided client, exposed for testing
    pub(crate) async fn list_pods_with_client(client: Client) -> Result<Vec<Pod>, Box<dyn Error + Send + Sync>> {
        let pods: Api<Pod> = Api::all(client);
        let list = pods.list(&Default::default()).await.map_err(|e| Box::new(e) as Box<dyn Error + Send + Sync>)?;
        Ok(list.items)
    }
}

#[async_trait]
impl K8sService for K8sClient {
    async fn get_contexts(&self) -> Result<Vec<String>, Box<dyn Error + Send + Sync>> {
        let kubeconfig: Kubeconfig =
            Kubeconfig::read().map_err(|e| Box::new(e) as Box<dyn Error + Send + Sync>)?;
        Ok(Self::extract_contexts(kubeconfig))
    }

    async fn list_pods(
        &self,
        context_name: &str,
    ) -> Result<Vec<Pod>, Box<dyn Error + Send + Sync>> {
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

        Self::list_pods_with_client(client).await
    }
}
