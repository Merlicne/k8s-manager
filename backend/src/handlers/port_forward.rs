use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::AppState;

#[derive(Deserialize)]
pub struct PortForwardRequest {
    pub context: String,
    pub namespace: String,
    pub service_name: String,
    pub service_port: u16,
    pub local_port: u16,
}

#[derive(Serialize)]
pub struct ErrorResponse {
    pub message: String,
}

pub async fn start_port_forward(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<PortForwardRequest>,
) -> impl IntoResponse {
    match state.port_forward_manager.start_forward(
        &payload.context,
        &payload.namespace,
        "service",
        &payload.service_name,
        payload.local_port,
        payload.service_port,
    ) {
        Ok(info) => (StatusCode::OK, Json(info)).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse { message: e }),
        )
            .into_response(),
    }
}

pub async fn stop_port_forward(
    State(state): State<Arc<AppState>>,
    Path(local_port): Path<u16>,
) -> impl IntoResponse {
    match state.port_forward_manager.stop_forward(local_port) {
        Ok(_) => (StatusCode::OK, Json(ErrorResponse { message: "Stopped".to_string() })).into_response(),
        Err(e) => (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse { message: e }),
        )
            .into_response(),
    }
}

pub async fn list_port_forwards(
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let ports = state.port_forward_manager.list_forwards();
    Json(ports).into_response()
}
