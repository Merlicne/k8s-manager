use crate::models::K8sResourceType;
use crate::services::k8s::K8sService;
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

#[derive(Deserialize)]
pub struct GetResourceQuery {
    namespace: Option<String>,
}

pub async fn list_contexts(State(service): State<Arc<dyn K8sService>>) -> Json<Value> {
    match service.get_contexts().await {
        Ok(contexts) => Json(json!({ "contexts": contexts })),
        Err(e) => Json(json!({ "error": e.to_string() })),
    }
}

pub async fn list_resources(
    State(service): State<Arc<dyn K8sService>>,
    Path((context, resource_type)): Path<(String, K8sResourceType)>,
) -> Json<Value> {
    match service.list_resources(&context, resource_type).await {
        Ok(resources) => Json(json!(resources)),
        Err(e) => Json(json!({ "error": format!("Failed to list resources: {}", e) })),
    }
}

pub async fn get_resource(
    State(service): State<Arc<dyn K8sService>>,
    Path((context, resource_type, name)): Path<(String, K8sResourceType, String)>,
    Query(query): Query<GetResourceQuery>,
) -> Json<Value> {
    match service
        .get_resource(&context, resource_type, &name, query.namespace)
        .await
    {
        Ok(resource) => Json(resource),
        Err(e) => Json(json!({ "error": format!("Failed to get resource: {}", e) })),
    }
}

pub async fn get_resource_graph(
    State(service): State<Arc<dyn K8sService>>,
    Path((context, resource_type, name)): Path<(String, K8sResourceType, String)>,
    Query(query): Query<GetResourceQuery>,
) -> Json<Value> {
    match service
        .get_resource_graph(&context, resource_type, &name, query.namespace)
        .await
    {
        Ok(graph) => Json(json!(graph)),
        Err(e) => Json(json!({ "error": format!("Failed to get resource graph: {}", e) })),
    }
}
