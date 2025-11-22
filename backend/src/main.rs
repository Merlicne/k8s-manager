use axum::{
    routing::get,
    Router,
    Json,
};
use std::net::SocketAddr;
use tower_http::cors::{CorsLayer, Any};
use serde_json::{json, Value};

mod k8s;
mod routes;

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    // CORS setup to allow frontend to talk to backend
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Build our application with a route
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/contexts", get(routes::list_contexts))
        .route("/api/{context}/pods", get(routes::list_pods))
        .layer(cors);

    // Run it
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("Backend listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health_check() -> Json<Value> {
    Json(json!({ "status": "ok", "message": "K8s Manager Backend is running" }))
}
