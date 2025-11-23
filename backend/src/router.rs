use axum::{
    routing::get,
    Router,
};
use std::sync::Arc;
use crate::handlers::{health, k8s};
use crate::services::k8s::K8sService;

pub fn create_router(k8s_service: Arc<dyn K8sService>) -> Router {
    Router::new()
        .route("/health", get(health::health_check))
        .route("/api/contexts", get(k8s::list_contexts))
        .route("/api/{context}/resources/{resource_type}", get(k8s::list_resources))
        .with_state(k8s_service)
}
