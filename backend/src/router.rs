use crate::handlers::{health, k8s, port_forward};
use crate::AppState;
use axum::{
    routing::{delete, get, post},
    Router,
};
use std::sync::Arc;

pub fn create_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/health", get(health::health_check))
        .route("/api/contexts", get(k8s::list_contexts))
        .route(
            "/api/{context}/resources/{resource_type}",
            get(k8s::list_resources),
        )
        .route(
            "/api/{context}/resources/{resource_type}/{name}",
            get(k8s::get_resource),
        )
        .route(
            "/api/{context}/resources/{resource_type}/{name}/graph",
            get(k8s::get_resource_graph),
        )
        .route(
            "/api/port-forward",
            post(port_forward::start_port_forward).get(port_forward::list_port_forwards),
        )
        .route(
            "/api/port-forward/{local_port}",
            delete(port_forward::stop_port_forward),
        )
        .with_state(state)
}
