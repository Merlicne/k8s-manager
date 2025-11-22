use crate::services::k8s::K8sService;
use axum::{
    extract::{Path, State},
    Json,
};
use kube::ResourceExt;
use serde_json::{json, Value};
use std::sync::Arc;

pub async fn list_contexts(State(service): State<Arc<dyn K8sService>>) -> Json<Value> {
    match service.get_contexts().await {
        Ok(contexts) => Json(json!({ "contexts": contexts })),
        Err(e) => Json(json!({ "error": e.to_string() })),
    }
}

pub async fn list_pods(
    State(service): State<Arc<dyn K8sService>>,
    Path(context): Path<String>,
) -> Json<Value> {
    match service.list_pods(&context).await {
        Ok(pods) => {
            let items: Vec<Value> = pods
                .into_iter()
                .map(|pod| {
                    json!({
                        "name": pod.name_any(),
                        "namespace": pod.namespace(),
                        "status": pod.status.as_ref().map(|s| s.phase.clone()).unwrap_or_default(),
                        "node": pod.spec.as_ref().and_then(|s| s.node_name.clone()),
                    })
                })
                .collect();
            Json(json!({ "pods": items }))
        }
        Err(e) => Json(json!({ "error": format!("Failed to list pods: {}", e) })),
    }
}
