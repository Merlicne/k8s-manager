use axum::{
    extract::Path,
    Json,
};
use k8s_openapi::api::core::v1::Pod;
use kube::{Api, ResourceExt};
use serde_json::{json, Value};
use crate::k8s;

pub async fn list_contexts() -> Json<Value> {
    match k8s::get_contexts().await {
        Ok(contexts) => Json(json!({ "contexts": contexts })),
        Err(e) => Json(json!({ "error": e.to_string() })),
    }
}

pub async fn list_pods(Path(context): Path<String>) -> Json<Value> {
    let client = match k8s::create_client(&context).await {
        Ok(c) => c,
        Err(e) => return Json(json!({ "error": format!("Failed to create client: {}", e) })),
    };

    let pods: Api<Pod> = Api::all(client);
    match pods.list(&Default::default()).await {
        Ok(p) => {
            let items: Vec<Value> = p.items.into_iter().map(|pod| {
                json!({
                    "name": pod.name_any(),
                    "namespace": pod.namespace(),
                    "status": pod.status.as_ref().map(|s| s.phase.clone()).unwrap_or_default(),
                    "node": pod.spec.as_ref().and_then(|s| s.node_name.clone()),
                })
            }).collect();
            Json(json!({ "pods": items }))
        },
        Err(e) => Json(json!({ "error": format!("Failed to list pods: {}", e) })),
    }
}
