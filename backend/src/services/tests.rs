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

    #[tokio::test]
    async fn test_get_resource_graph_pod_owner() {
        let (mock_service, mut handle) =
            mock::pair::<Request<kube::client::Body>, Response<kube::client::Body>>();
        let client = Client::new(mock_service, "default");

        tokio::spawn(async move {
            // 1. Expect GET Pod
            let (request, send) = handle
                .next_request()
                .await
                .expect("Service not called for Pod");
            assert_eq!(
                request.uri().path(),
                "/api/v1/namespaces/default/pods/my-pod"
            );

            let pod = Pod {
                metadata: k8s_openapi::apimachinery::pkg::apis::meta::v1::ObjectMeta {
                    name: Some("my-pod".to_string()),
                    namespace: Some("default".to_string()),
                    uid: Some("pod-uid".to_string()),
                    owner_references: Some(vec![
                        k8s_openapi::apimachinery::pkg::apis::meta::v1::OwnerReference {
                            api_version: "apps/v1".to_string(),
                            kind: "ReplicaSet".to_string(),
                            name: "my-rs".to_string(),
                            uid: "rs-uid".to_string(),
                            ..Default::default()
                        },
                    ]),
                    ..Default::default()
                },
                ..Default::default()
            };

            let response = Response::builder()
                .body(kube::client::Body::from(serde_json::to_vec(&pod).unwrap()))
                .unwrap();
            send.send_response(response);

            // 2. Expect GET ReplicaSet (Owner)
            let (request, send) = handle
                .next_request()
                .await
                .expect("Service not called for RS");
            assert_eq!(
                request.uri().path(),
                "/apis/apps/v1/namespaces/default/replicasets/my-rs"
            );

            let rs = k8s_openapi::api::apps::v1::ReplicaSet {
                metadata: k8s_openapi::apimachinery::pkg::apis::meta::v1::ObjectMeta {
                    name: Some("my-rs".to_string()),
                    namespace: Some("default".to_string()),
                    uid: Some("rs-uid".to_string()),
                    ..Default::default()
                },
                ..Default::default()
            };

            let response = Response::builder()
                .body(kube::client::Body::from(serde_json::to_vec(&rs).unwrap()))
                .unwrap();
            send.send_response(response);
        });

        let graph = K8sClient::get_resource_graph_with_client(
            client,
            K8sResourceType::Pod,
            "my-pod",
            Some("default".to_string()),
        )
        .await
        .unwrap();

        assert_eq!(graph.nodes.len(), 2);
        assert_eq!(graph.edges.len(), 1);
        // Check edge direction: Owner -> Child
        let edge = &graph.edges[0];
        assert_eq!(edge.source, "rs-uid");
        assert_eq!(edge.target, "pod-uid");
        assert_eq!(edge.label, "owner");
    }

    #[tokio::test]
    async fn test_get_resource_graph_pod_reverse_networking() {
        let (mock_service, mut handle) =
            mock::pair::<Request<kube::client::Body>, Response<kube::client::Body>>();
        let client = Client::new(mock_service, "default");

        tokio::spawn(async move {
            // 1. Expect GET Pod
            let (request, send) = handle
                .next_request()
                .await
                .expect("Service not called for Pod");
            assert_eq!(
                request.uri().path(),
                "/api/v1/namespaces/default/pods/target-pod"
            );

            let pod = Pod {
                metadata: k8s_openapi::apimachinery::pkg::apis::meta::v1::ObjectMeta {
                    name: Some("target-pod".to_string()),
                    namespace: Some("default".to_string()),
                    uid: Some("pod-uid".to_string()),
                    labels: Some(std::collections::BTreeMap::from([(
                        "app".to_string(),
                        "myapp".to_string(),
                    )])),
                    ..Default::default()
                },
                ..Default::default()
            };

            let response = Response::builder()
                .body(kube::client::Body::from(serde_json::to_vec(&pod).unwrap()))
                .unwrap();
            send.send_response(response);

            // 2. Expect LIST Services (Reverse Networking check)
            let (request, send) = handle
                .next_request()
                .await
                .expect("Service not called for List Services");
            assert_eq!(request.uri().path(), "/api/v1/namespaces/default/services");

            let svc = k8s_openapi::api::core::v1::Service {
                metadata: k8s_openapi::apimachinery::pkg::apis::meta::v1::ObjectMeta {
                    name: Some("my-service".to_string()),
                    namespace: Some("default".to_string()),
                    uid: Some("svc-uid".to_string()),
                    ..Default::default()
                },
                spec: Some(k8s_openapi::api::core::v1::ServiceSpec {
                    selector: Some(std::collections::BTreeMap::from([(
                        "app".to_string(),
                        "myapp".to_string(),
                    )])),
                    ..Default::default()
                }),
                ..Default::default()
            };

            let svc_list = List {
                items: vec![svc],
                metadata: Default::default(),
            };

            let response = Response::builder()
                .body(kube::client::Body::from(
                    serde_json::to_vec(&svc_list).unwrap(),
                ))
                .unwrap();
            send.send_response(response);
        });

        let graph = K8sClient::get_resource_graph_with_client(
            client,
            K8sResourceType::Pod,
            "target-pod",
            Some("default".to_string()),
        )
        .await
        .unwrap();

        // Should have Pod and Service
        assert_eq!(graph.nodes.len(), 2);
        assert_eq!(graph.edges.len(), 1);

        // Check edge direction: Service -> Pod (selects)
        let edge = &graph.edges[0];
        assert_eq!(edge.source, "svc-uid");
        assert_eq!(edge.target, "pod-uid");
        assert_eq!(edge.label, "selects");
    }
}
