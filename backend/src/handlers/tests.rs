#[cfg(test)]
mod tests {
    use super::super::k8s::{list_contexts, list_resources};
    use crate::managers::port_forward::PortForwardManager;
    use crate::models::K8sResourceType;
    use crate::services::k8s::MockK8sService;
    use crate::AppState;
    use axum::{
        extract::{Path, State},
        Json,
    };
    use std::sync::Arc;

    #[tokio::test]
    async fn test_list_contexts_success() {
        let mut mock_service = MockK8sService::new();
        mock_service
            .expect_get_contexts()
            .times(1)
            .returning(|| Ok(vec!["context1".to_string(), "context2".to_string()]));

        let state = State(Arc::new(AppState {
            k8s_service: Arc::new(mock_service),
            port_forward_manager: PortForwardManager::new(),
        }));
        let Json(response) = list_contexts(state).await;

        assert_eq!(response["contexts"][0], "context1");
        assert_eq!(response["contexts"][1], "context2");
    }

    #[tokio::test]
    async fn test_list_contexts_error() {
        let mut mock_service = MockK8sService::new();
        mock_service
            .expect_get_contexts()
            .times(1)
            .returning(|| Err(Box::from("K8s error")));

        let state = State(Arc::new(AppState {
            k8s_service: Arc::new(mock_service),
            port_forward_manager: PortForwardManager::new(),
        }));
        let Json(response) = list_contexts(state).await;

        assert_eq!(response["error"], "K8s error");
    }

    #[tokio::test]
    async fn test_list_resources_success() {
        let mut mock_service = MockK8sService::new();
        mock_service
            .expect_list_resources()
            .with(
                mockall::predicate::eq("minikube"),
                mockall::predicate::eq(K8sResourceType::Pod),
            )
            .times(1)
            .returning(|_, _| {
                Ok(vec![serde_json::json!({
                    "metadata": {
                        "name": "test-pod",
                        "namespace": "default"
                    }
                })])
            });

        let state = State(Arc::new(AppState {
            k8s_service: Arc::new(mock_service),
            port_forward_manager: PortForwardManager::new(),
        }));
        let path = Path(("minikube".to_string(), K8sResourceType::Pod));
        let Json(response) = list_resources(state, path).await;

        assert_eq!(response[0]["metadata"]["name"], "test-pod");
    }
}
