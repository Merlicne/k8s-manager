#[cfg(test)]
mod tests {
    use super::super::k8s::K8sClient;
    use crate::models::K8sResourceType;
    use http::{Request, Response};
    use k8s_openapi::api::core::v1::Pod;
    use k8s_openapi::List;
    use kube::config::{Kubeconfig, NamedContext};
    use kube::Client;
    use tower_test::mock;

    #[test]
    fn test_extract_contexts() {
        let mut config = Kubeconfig::default();
        config.contexts.push(NamedContext {
            name: "ctx1".to_string(),
            context: Default::default(),
        });
        config.contexts.push(NamedContext {
            name: "ctx2".to_string(),
            context: Default::default(),
        });

        let contexts = K8sClient::extract_contexts(config);
        assert_eq!(contexts, vec!["ctx1", "ctx2"]);
    }

    #[tokio::test]
    async fn test_list_resources_pod() {
        let (mock_service, mut handle) =
            mock::pair::<Request<kube::client::Body>, Response<kube::client::Body>>();
        let client = Client::new(mock_service, "default");

        // Spawn a task to handle the request
        tokio::spawn(async move {
            let (request, send) = handle.next_request().await.expect("Service not called");
            assert_eq!(request.uri().path(), "/api/v1/pods");

            let pod_list = List {
                items: vec![Pod {
                    metadata: k8s_openapi::apimachinery::pkg::apis::meta::v1::ObjectMeta {
                        name: Some("pod-generic".to_string()),
                        ..Default::default()
                    },
                    ..Default::default()
                }],
                metadata: Default::default(),
            };

            let response = Response::builder()
                .body(kube::client::Body::from(
                    serde_json::to_vec(&pod_list).unwrap(),
                ))
                .unwrap();
            send.send_response(response);
        });

        let resources = K8sClient::list_resources_with_client(client, K8sResourceType::Pod)
            .await
            .unwrap();
        assert_eq!(resources.len(), 1);
        assert_eq!(resources[0]["metadata"]["name"], "pod-generic");
    }
}
