#[cfg(test)]
mod tests {
    use super::super::k8s::{list_contexts, list_pods};
    use crate::services::k8s::{K8sService, MockK8sService};
    use axum::{
        extract::{Path, State},
        Json,
    };
    use k8s_openapi::api::core::v1::Pod;
    use std::sync::Arc;

    #[tokio::test]
    async fn test_list_contexts_success() {
        let mut mock_service = MockK8sService::new();
        mock_service
            .expect_get_contexts()
            .times(1)
            .returning(|| Ok(vec!["context1".to_string(), "context2".to_string()]));

        let state = State(Arc::new(mock_service) as Arc<dyn K8sService>);
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

        let state = State(Arc::new(mock_service) as Arc<dyn K8sService>);
        let Json(response) = list_contexts(state).await;

        assert_eq!(response["error"], "K8s error");
    }

    #[tokio::test]
    async fn test_list_pods_success() {
        let mut mock_service = MockK8sService::new();
        mock_service
            .expect_list_pods()
            .with(mockall::predicate::eq("minikube"))
            .times(1)
            .returning(|_| {
                let mut pod = Pod::default();
                pod.metadata.name = Some("test-pod".to_string());
                pod.metadata.namespace = Some("default".to_string());
                Ok(vec![pod])
            });

        let state = State(Arc::new(mock_service) as Arc<dyn K8sService>);
        let path = Path("minikube".to_string());
        let Json(response) = list_pods(state, path).await;

        assert_eq!(response["pods"][0]["name"], "test-pod");
        assert_eq!(response["pods"][0]["namespace"], "default");
    }
}
