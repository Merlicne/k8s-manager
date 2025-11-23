use crate::models::{GraphData, GraphEdge, GraphNode, K8sResourceType};
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
    async fn get_resource_graph(
        &self,
        context_name: &str,
        resource_type: K8sResourceType,
        name: &str,
        namespace: Option<String>,
    ) -> Result<GraphData, Box<dyn Error + Send + Sync>>;
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

    /// Helper to get resource graph using a provided client, exposed for testing
    pub(crate) async fn get_resource_graph_with_client(
        client: Client,
        resource_type: K8sResourceType,
        name: &str,
        namespace: Option<String>,
    ) -> Result<GraphData, Box<dyn Error + Send + Sync>> {
        let mut nodes = Vec::new();
        let mut edges = Vec::new();

        // 1. Fetch the primary resource
        let resource_json = Self::get_resource_with_client(
            client.clone(),
            resource_type.clone(),
            name,
            namespace.clone(),
        )
        .await?;

        // Extract metadata
        let metadata = resource_json
            .get("metadata")
            .and_then(|m| m.as_object())
            .ok_or("Missing metadata")?;
        let uid = metadata
            .get("uid")
            .and_then(|u| u.as_str())
            .ok_or("Missing UID")?
            .to_string();
        let name = metadata
            .get("name")
            .and_then(|n| n.as_str())
            .unwrap_or(name)
            .to_string();

        // Add primary node
        nodes.push(GraphNode {
            id: uid.clone(),
            label: name.clone(),
            resource_type: format!("{:?}", resource_type),
            data: resource_json.clone(),
        });

        // 2. Check OwnerReferences (Upstream)
        if let Some(owner_refs) = metadata.get("ownerReferences").and_then(|o| o.as_array()) {
            for owner in owner_refs {
                let owner_kind = owner
                    .get("kind")
                    .and_then(|k| k.as_str())
                    .unwrap_or_default();
                let owner_name = owner
                    .get("name")
                    .and_then(|n| n.as_str())
                    .unwrap_or_default();
                let owner_uid = owner
                    .get("uid")
                    .and_then(|u| u.as_str())
                    .unwrap_or_default();

                if let Some(owner_type) = K8sResourceType::from_kind(owner_kind) {
                    // Fetch owner details
                    if let Ok(owner_resource) = Self::get_resource_with_client(
                        client.clone(),
                        owner_type.clone(),
                        owner_name,
                        namespace.clone(),
                    )
                    .await
                    {
                        nodes.push(GraphNode {
                            id: owner_uid.to_string(),
                            label: owner_name.to_string(),
                            resource_type: format!("{:?}", owner_type),
                            data: owner_resource,
                        });

                        edges.push(GraphEdge {
                            id: format!("{}-{}", owner_uid, uid),
                            source: owner_uid.to_string(),
                            target: uid.clone(),
                            label: "owner".to_string(),
                        });
                    }
                }
            }
        }

        // 3. Check Service Selectors (Downstream)
        if resource_type == K8sResourceType::Service {
            if let Some(spec) = resource_json.get("spec") {
                if let Some(selector) = spec.get("selector").and_then(|s| s.as_object()) {
                    let selector_str = selector
                        .iter()
                        .map(|(k, v)| format!("{}={}", k, v.as_str().unwrap_or("")))
                        .collect::<Vec<_>>()
                        .join(",");

                    if !selector_str.is_empty() {
                        let api_resource = K8sResourceType::Pod.get_api_resource();
                        let api: Api<kube::api::DynamicObject> = if let Some(ns) = &namespace {
                            Api::namespaced_with(client.clone(), ns, &api_resource)
                        } else {
                            Api::all_with(client.clone(), &api_resource)
                        };

                        let lp = kube::api::ListParams::default().labels(&selector_str);
                        if let Ok(pod_list) = api.list(&lp).await {
                            for pod in pod_list {
                                let pod_meta = pod.metadata;
                                let pod_uid = pod_meta
                                    .uid
                                    .as_ref()
                                    .map(|s| s.to_string())
                                    .unwrap_or_default();
                                let pod_name = pod_meta
                                    .name
                                    .as_ref()
                                    .map(|s| s.to_string())
                                    .unwrap_or_default();

                                // Reconstruct full object for data
                                let mut pod_data =
                                    serde_json::to_value(pod.data).unwrap_or_default();
                                if let Some(obj) = pod_data.as_object_mut() {
                                    obj.insert(
                                        "metadata".to_string(),
                                        serde_json::to_value(&pod_meta).unwrap_or_default(),
                                    );
                                }

                                nodes.push(GraphNode {
                                    id: pod_uid.clone(),
                                    label: pod_name,
                                    resource_type: "Pod".to_string(),
                                    data: pod_data,
                                });

                                edges.push(GraphEdge {
                                    id: format!("{}-{}", uid, pod_uid),
                                    source: uid.clone(),
                                    target: pod_uid,
                                    label: "selects".to_string(),
                                });
                            }
                        }
                    }
                }
            }
        }

        // 4. Check Reverse Networking (Pod -> Services)
        if resource_type == K8sResourceType::Pod {
            let pod_labels = metadata.get("labels").and_then(|l| l.as_object());
            if let Some(labels) = pod_labels {
                // List all services in namespace
                let api_resource = K8sResourceType::Service.get_api_resource();
                let api: Api<kube::api::DynamicObject> = if let Some(ns) = &namespace {
                    Api::namespaced_with(client.clone(), ns, &api_resource)
                } else {
                    Api::all_with(client.clone(), &api_resource)
                };

                if let Ok(services) = api.list(&Default::default()).await {
                    for svc in services {
                        let svc_meta = svc.metadata;
                        let svc_spec = svc.data.get("spec");
                        // Check selector
                        if let Some(selector) = svc_spec
                            .and_then(|s| s.get("selector"))
                            .and_then(|s| s.as_object())
                        {
                            let mut match_all = true;
                            for (k, v) in selector {
                                let v_str = v.as_str().unwrap_or_default();
                                if labels.get(k).and_then(|l| l.as_str()).unwrap_or_default()
                                    != v_str
                                {
                                    match_all = false;
                                    break;
                                }
                            }

                            if match_all && !selector.is_empty() {
                                // Add Service Node
                                let svc_uid = svc_meta.uid.clone().unwrap_or_default();
                                let svc_name = svc_meta.name.clone().unwrap_or_default();

                                // Reconstruct data
                                let mut svc_data =
                                    serde_json::to_value(svc.data).unwrap_or_default();
                                if let Some(obj) = svc_data.as_object_mut() {
                                    obj.insert(
                                        "metadata".to_string(),
                                        serde_json::to_value(&svc_meta).unwrap_or_default(),
                                    );
                                }

                                nodes.push(GraphNode {
                                    id: svc_uid.clone(),
                                    label: svc_name,
                                    resource_type: "Service".to_string(),
                                    data: svc_data,
                                });

                                edges.push(GraphEdge {
                                    id: format!("{}-{}", svc_uid, uid),
                                    source: svc_uid,
                                    target: uid.clone(),
                                    label: "selects".to_string(),
                                });
                            }
                        }
                    }
                }
            }
        }

        // 5. Check Pod Configuration & Storage (Pod -> CM, Secret, PVC)
        if resource_type == K8sResourceType::Pod {
            if let Some(spec) = resource_json.get("spec") {
                // Collect dependencies to fetch
                let mut deps = Vec::new(); // (Type, Name, EdgeLabel)                // Check Volumes
                if let Some(volumes) = spec.get("volumes").and_then(|v| v.as_array()) {
                    for vol in volumes {
                        if let Some(cm) = vol.get("configMap") {
                            if let Some(name) = cm.get("name").and_then(|n| n.as_str()) {
                                deps.push((K8sResourceType::ConfigMap, name.to_string(), "uses"));
                            }
                        }
                        if let Some(secret) = vol.get("secret") {
                            if let Some(name) = secret.get("secretName").and_then(|n| n.as_str()) {
                                deps.push((K8sResourceType::Secret, name.to_string(), "uses"));
                            }
                        }
                        if let Some(pvc) = vol.get("persistentVolumeClaim") {
                            if let Some(name) = pvc.get("claimName").and_then(|n| n.as_str()) {
                                deps.push((
                                    K8sResourceType::PersistentVolumeClaim,
                                    name.to_string(),
                                    "uses",
                                ));
                            }
                        }
                    }
                }

                // Check Containers for Env
                let mut containers = Vec::new();
                if let Some(c) = spec.get("containers").and_then(|c| c.as_array()) {
                    containers.extend(c);
                }
                if let Some(c) = spec.get("initContainers").and_then(|c| c.as_array()) {
                    containers.extend(c);
                }

                for container in containers {
                    // env
                    if let Some(env) = container.get("env").and_then(|e| e.as_array()) {
                        for e in env {
                            if let Some(val_from) = e.get("valueFrom") {
                                if let Some(cm) = val_from.get("configMapKeyRef") {
                                    if let Some(name) = cm.get("name").and_then(|n| n.as_str()) {
                                        deps.push((
                                            K8sResourceType::ConfigMap,
                                            name.to_string(),
                                            "uses",
                                        ));
                                    }
                                }
                                if let Some(secret) = val_from.get("secretKeyRef") {
                                    if let Some(name) = secret.get("name").and_then(|n| n.as_str())
                                    {
                                        deps.push((
                                            K8sResourceType::Secret,
                                            name.to_string(),
                                            "uses",
                                        ));
                                    }
                                }
                            }
                        }
                    }
                    // envFrom
                    if let Some(env_from) = container.get("envFrom").and_then(|e| e.as_array()) {
                        for e in env_from {
                            if let Some(cm) = e.get("configMapRef") {
                                if let Some(name) = cm.get("name").and_then(|n| n.as_str()) {
                                    deps.push((
                                        K8sResourceType::ConfigMap,
                                        name.to_string(),
                                        "uses",
                                    ));
                                }
                            }
                            if let Some(secret) = e.get("secretRef") {
                                if let Some(name) = secret.get("name").and_then(|n| n.as_str()) {
                                    deps.push((K8sResourceType::Secret, name.to_string(), "uses"));
                                }
                            }
                        }
                    }
                }

                // Fetch and add dependencies
                for (rtype, rname, edge_label) in deps {
                    if let Ok(res) = Self::get_resource_with_client(
                        client.clone(),
                        rtype.clone(),
                        &rname,
                        namespace.clone(),
                    )
                    .await
                    {
                        let r_uid = res
                            .get("metadata")
                            .and_then(|m| m.get("uid"))
                            .and_then(|u| u.as_str())
                            .unwrap_or_default()
                            .to_string();

                        // Avoid duplicates
                        if !nodes.iter().any(|n| n.id == r_uid) {
                            nodes.push(GraphNode {
                                id: r_uid.to_string(),
                                label: rname.clone(),
                                resource_type: format!("{:?}", rtype),
                                data: res,
                            });
                        }

                        edges.push(GraphEdge {
                            id: format!("{}-{}", uid, r_uid),
                            source: uid.clone(),
                            target: r_uid.to_string(),
                            label: edge_label.to_string(),
                        });
                    }
                }
            }
        }

        // 6. Check PVC -> PV & StorageClass
        if resource_type == K8sResourceType::PersistentVolumeClaim {
            if let Some(spec) = resource_json.get("spec") {
                // StorageClass
                if let Some(sc_name) = spec.get("storageClassName").and_then(|s| s.as_str()) {
                    if let Ok(res) = Self::get_resource_with_client(
                        client.clone(),
                        K8sResourceType::StorageClass,
                        sc_name,
                        None, // Cluster scoped
                    )
                    .await
                    {
                        let sc_uid = res
                            .get("metadata")
                            .and_then(|m| m.get("uid"))
                            .and_then(|u| u.as_str())
                            .unwrap_or_default()
                            .to_string();

                        nodes.push(GraphNode {
                            id: sc_uid.to_string(),
                            label: sc_name.to_string(),
                            resource_type: "StorageClass".to_string(),
                            data: res,
                        });

                        edges.push(GraphEdge {
                            id: format!("{}-{}", uid, sc_uid),
                            source: uid.clone(),
                            target: sc_uid.to_string(),
                            label: "uses".to_string(),
                        });
                    }
                }
                // VolumeName (PV)
                if let Some(pv_name) = spec.get("volumeName").and_then(|s| s.as_str()) {
                    if let Ok(res) = Self::get_resource_with_client(
                        client.clone(),
                        K8sResourceType::PersistentVolume,
                        pv_name,
                        None, // Cluster scoped
                    )
                    .await
                    {
                        let pv_uid = res
                            .get("metadata")
                            .and_then(|m| m.get("uid"))
                            .and_then(|u| u.as_str())
                            .unwrap_or_default()
                            .to_string();

                        nodes.push(GraphNode {
                            id: pv_uid.to_string(),
                            label: pv_name.to_string(),
                            resource_type: "PersistentVolume".to_string(),
                            data: res,
                        });

                        edges.push(GraphEdge {
                            id: format!("{}-{}", uid, pv_uid),
                            source: uid.clone(),
                            target: pv_uid.to_string(),
                            label: "bound".to_string(),
                        });
                    }
                }
            }
        }

        // 7. Check PV -> PVC
        if resource_type == K8sResourceType::PersistentVolume {
            if let Some(spec) = resource_json.get("spec") {
                if let Some(claim_ref) = spec.get("claimRef") {
                    let claim_name = claim_ref.get("name").and_then(|n| n.as_str());
                    let claim_ns = claim_ref.get("namespace").and_then(|n| n.as_str());

                    if let (Some(name), Some(ns)) = (claim_name, claim_ns) {
                        if let Ok(res) = Self::get_resource_with_client(
                            client.clone(),
                            K8sResourceType::PersistentVolumeClaim,
                            name,
                            Some(ns.to_string()),
                        )
                        .await
                        {
                            let pvc_uid = res
                                .get("metadata")
                                .and_then(|m| m.get("uid"))
                                .and_then(|u| u.as_str())
                                .unwrap_or_default()
                                .to_string();

                            nodes.push(GraphNode {
                                id: pvc_uid.to_string(),
                                label: name.to_string(),
                                resource_type: "PersistentVolumeClaim".to_string(),
                                data: res,
                            });

                            edges.push(GraphEdge {
                                id: format!("{}-{}", uid, pvc_uid),
                                source: uid.clone(),
                                target: pvc_uid.to_string(),
                                label: "bound".to_string(),
                            });
                        }
                    }
                }
            }
        }

        // 8. Reverse Lookups (Who uses me?)
        // ConfigMap/Secret/PVC -> Pods
        if matches!(
            resource_type,
            K8sResourceType::ConfigMap
                | K8sResourceType::Secret
                | K8sResourceType::PersistentVolumeClaim
        ) {
            if let Some(ns) = &namespace {
                let api_resource = K8sResourceType::Pod.get_api_resource();
                let api: Api<kube::api::DynamicObject> =
                    Api::namespaced_with(client.clone(), ns, &api_resource);

                if let Ok(pods) = api.list(&Default::default()).await {
                    for pod in pods {
                        let pod_meta = pod.metadata;
                        let pod_uid = pod_meta.uid.clone().unwrap_or_default();
                        let pod_name = pod_meta.name.clone().unwrap_or_default();

                        let mut uses_me = false;

                        if let Some(spec) = pod.data.get("spec") {
                            // Check Volumes
                            if let Some(volumes) = spec.get("volumes").and_then(|v| v.as_array()) {
                                for vol in volumes {
                                    match resource_type {
                                        K8sResourceType::ConfigMap => {
                                            if let Some(cm) = vol.get("configMap") {
                                                if cm.get("name").and_then(|n| n.as_str())
                                                    == Some(&name)
                                                {
                                                    uses_me = true;
                                                }
                                            }
                                        }
                                        K8sResourceType::Secret => {
                                            if let Some(s) = vol.get("secret") {
                                                if s.get("secretName").and_then(|n| n.as_str())
                                                    == Some(&name)
                                                {
                                                    uses_me = true;
                                                }
                                            }
                                        }
                                        K8sResourceType::PersistentVolumeClaim => {
                                            if let Some(p) = vol.get("persistentVolumeClaim") {
                                                if p.get("claimName").and_then(|n| n.as_str())
                                                    == Some(&name)
                                                {
                                                    uses_me = true;
                                                }
                                            }
                                        }
                                        _ => {}
                                    }
                                }
                            }
                            // Check Env (only for CM/Secret)
                            if !uses_me
                                && matches!(
                                    resource_type,
                                    K8sResourceType::ConfigMap | K8sResourceType::Secret
                                )
                            {
                                let mut containers = Vec::new();
                                if let Some(c) = spec.get("containers").and_then(|c| c.as_array()) {
                                    containers.extend(c);
                                }
                                if let Some(c) =
                                    spec.get("initContainers").and_then(|c| c.as_array())
                                {
                                    containers.extend(c);
                                }

                                for container in containers {
                                    if let Some(env) =
                                        container.get("env").and_then(|e| e.as_array())
                                    {
                                        for e in env {
                                            if let Some(val_from) = e.get("valueFrom") {
                                                match resource_type {
                                                    K8sResourceType::ConfigMap => {
                                                        if let Some(r) =
                                                            val_from.get("configMapKeyRef")
                                                        {
                                                            if r.get("name")
                                                                .and_then(|n| n.as_str())
                                                                == Some(&name)
                                                            {
                                                                uses_me = true;
                                                                break;
                                                            }
                                                        }
                                                    }
                                                    K8sResourceType::Secret => {
                                                        if let Some(r) =
                                                            val_from.get("secretKeyRef")
                                                        {
                                                            if r.get("name")
                                                                .and_then(|n| n.as_str())
                                                                == Some(&name)
                                                            {
                                                                uses_me = true;
                                                                break;
                                                            }
                                                        }
                                                    }
                                                    _ => {}
                                                }
                                            }
                                        }
                                    }
                                    if uses_me {
                                        break;
                                    }

                                    if let Some(env_from) =
                                        container.get("envFrom").and_then(|e| e.as_array())
                                    {
                                        for e in env_from {
                                            match resource_type {
                                                K8sResourceType::ConfigMap => {
                                                    if let Some(r) = e.get("configMapRef") {
                                                        if r.get("name").and_then(|n| n.as_str())
                                                            == Some(&name)
                                                        {
                                                            uses_me = true;
                                                            break;
                                                        }
                                                    }
                                                }
                                                K8sResourceType::Secret => {
                                                    if let Some(r) = e.get("secretRef") {
                                                        if r.get("name").and_then(|n| n.as_str())
                                                            == Some(&name)
                                                        {
                                                            uses_me = true;
                                                            break;
                                                        }
                                                    }
                                                }
                                                _ => {}
                                            }
                                        }
                                    }
                                    if uses_me {
                                        break;
                                    }
                                }
                            }
                        }

                        if uses_me {
                            // Reconstruct data
                            let mut pod_data = serde_json::to_value(pod.data).unwrap_or_default();
                            if let Some(obj) = pod_data.as_object_mut() {
                                obj.insert(
                                    "metadata".to_string(),
                                    serde_json::to_value(&pod_meta).unwrap_or_default(),
                                );
                            }

                            nodes.push(GraphNode {
                                id: pod_uid.clone(),
                                label: pod_name,
                                resource_type: "Pod".to_string(),
                                data: pod_data,
                            });

                            edges.push(GraphEdge {
                                id: format!("{}-{}", pod_uid, uid),
                                source: pod_uid,
                                target: uid.clone(),
                                label: "uses".to_string(),
                            });
                        }
                    }
                }
            }
        }

        // StorageClass -> PVCs
        if resource_type == K8sResourceType::StorageClass {
            let api_resource = K8sResourceType::PersistentVolumeClaim.get_api_resource();
            let api: Api<kube::api::DynamicObject> = Api::all_with(client.clone(), &api_resource);

            if let Ok(pvcs) = api.list(&Default::default()).await {
                for pvc in pvcs {
                    let pvc_meta = pvc.metadata;
                    let pvc_uid = pvc_meta.uid.clone().unwrap_or_default();
                    let pvc_name = pvc_meta.name.clone().unwrap_or_default();

                    if let Some(spec) = pvc.data.get("spec") {
                        if let Some(sc) = spec.get("storageClassName").and_then(|s| s.as_str()) {
                            if sc == name {
                                // Reconstruct data
                                let mut pvc_data =
                                    serde_json::to_value(pvc.data).unwrap_or_default();
                                if let Some(obj) = pvc_data.as_object_mut() {
                                    obj.insert(
                                        "metadata".to_string(),
                                        serde_json::to_value(&pvc_meta).unwrap_or_default(),
                                    );
                                }

                                nodes.push(GraphNode {
                                    id: pvc_uid.clone(),
                                    label: pvc_name,
                                    resource_type: "PersistentVolumeClaim".to_string(),
                                    data: pvc_data,
                                });

                                edges.push(GraphEdge {
                                    id: format!("{}-{}", pvc_uid, uid),
                                    source: pvc_uid,
                                    target: uid.clone(),
                                    label: "uses".to_string(),
                                });
                            }
                        }
                    }
                }
            }
        }

        // 9. Check Deployment -> ReplicaSets (Downstream)
        if resource_type == K8sResourceType::Deployment {
            if let Some(ns) = &namespace {
                let api_resource = K8sResourceType::ReplicaSet.get_api_resource();
                let api: Api<kube::api::DynamicObject> =
                    Api::namespaced_with(client.clone(), ns, &api_resource);

                // We could use label selector from deployment spec, but checking ownerReferences is more reliable for "ownership"
                // However, listing all RS in namespace is fine.
                if let Ok(replicasets) = api.list(&Default::default()).await {
                    for rs in replicasets {
                        let rs_meta = rs.metadata;
                        let rs_uid = rs_meta.uid.clone().unwrap_or_default();
                        let rs_name = rs_meta.name.clone().unwrap_or_default();

                        // Check if this RS is owned by the current Deployment
                        let is_owned = rs_meta
                            .owner_references
                            .as_ref()
                            .map_or(false, |refs| refs.iter().any(|r| r.uid == uid));

                        if is_owned {
                            // Reconstruct data
                            let mut rs_data = serde_json::to_value(rs.data).unwrap_or_default();
                            if let Some(obj) = rs_data.as_object_mut() {
                                obj.insert(
                                    "metadata".to_string(),
                                    serde_json::to_value(&rs_meta).unwrap_or_default(),
                                );
                            }

                            nodes.push(GraphNode {
                                id: rs_uid.clone(),
                                label: rs_name,
                                resource_type: "ReplicaSet".to_string(),
                                data: rs_data,
                            });

                            edges.push(GraphEdge {
                                id: format!("{}-{}", uid, rs_uid),
                                source: uid.clone(),
                                target: rs_uid,
                                label: "manages".to_string(),
                            });
                        }
                    }
                }
            }
        }

        // 10. Check ReplicaSet -> Pods (Downstream)
        if resource_type == K8sResourceType::ReplicaSet {
            if let Some(ns) = &namespace {
                let api_resource = K8sResourceType::Pod.get_api_resource();
                let api: Api<kube::api::DynamicObject> =
                    Api::namespaced_with(client.clone(), ns, &api_resource);

                if let Ok(pods) = api.list(&Default::default()).await {
                    for pod in pods {
                        let pod_meta = pod.metadata;
                        let pod_uid = pod_meta.uid.clone().unwrap_or_default();
                        let pod_name = pod_meta.name.clone().unwrap_or_default();

                        // Check if this Pod is owned by the current ReplicaSet
                        let is_owned = pod_meta
                            .owner_references
                            .as_ref()
                            .map_or(false, |refs| refs.iter().any(|r| r.uid == uid));

                        if is_owned {
                            // Reconstruct data
                            let mut pod_data = serde_json::to_value(pod.data).unwrap_or_default();
                            if let Some(obj) = pod_data.as_object_mut() {
                                obj.insert(
                                    "metadata".to_string(),
                                    serde_json::to_value(&pod_meta).unwrap_or_default(),
                                );
                            }

                            nodes.push(GraphNode {
                                id: pod_uid.clone(),
                                label: pod_name,
                                resource_type: "Pod".to_string(),
                                data: pod_data,
                            });

                            edges.push(GraphEdge {
                                id: format!("{}-{}", uid, pod_uid),
                                source: uid.clone(),
                                target: pod_uid,
                                label: "manages".to_string(),
                            });
                        }
                    }
                }
            }
        }

        Ok(GraphData { nodes, edges })
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

    async fn get_resource_graph(
        &self,
        context_name: &str,
        resource_type: K8sResourceType,
        name: &str,
        namespace: Option<String>,
    ) -> Result<GraphData, Box<dyn Error + Send + Sync>> {
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

        Self::get_resource_graph_with_client(client, resource_type, name, namespace).await
    }
}
