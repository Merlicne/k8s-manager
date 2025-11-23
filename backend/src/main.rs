use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use crate::services::k8s::{K8sClient, K8sService};
use crate::managers::port_forward::PortForwardManager;

mod handlers;
mod router;
mod services;
mod models;
mod managers;

pub struct AppState {
    pub k8s_service: Arc<dyn K8sService>,
    pub port_forward_manager: PortForwardManager,
}

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    // CORS setup to allow frontend to talk to backend
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Initialize services
    let k8s_service = Arc::new(K8sClient::new());
    let port_forward_manager = PortForwardManager::new();

    let state = Arc::new(AppState {
        k8s_service,
        port_forward_manager,
    });

    // Build our application with a route
    let app = router::create_router(state).layer(cors);

    // Run it
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("Backend listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
