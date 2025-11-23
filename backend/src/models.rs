use kube::api::{ApiResource, GroupVersionKind};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum K8sResourceType {
    // Workload and Compute Objects
    Pod,
    Deployment,
    ReplicaSet,
    StatefulSet,
    DaemonSet,
    Job,
    CronJob,

    // Service & Networking Objects
    Service,
    Ingress,

    // Storage Objects
    PersistentVolume,
    PersistentVolumeClaim,

    // Configuration & Policy Objects
    ConfigMap,
    Secret,
    Namespace,
    Role,
    ClusterRole,
    RoleBinding,
    ClusterRoleBinding,
    ServiceAccount,
}

impl K8sResourceType {
    pub fn get_api_resource(&self) -> ApiResource {
        let gvk = match self {
            // Workload and Compute Objects
            Self::Pod => GroupVersionKind::gvk("", "v1", "Pod"),
            Self::Deployment => GroupVersionKind::gvk("apps", "v1", "Deployment"),
            Self::ReplicaSet => GroupVersionKind::gvk("apps", "v1", "ReplicaSet"),
            Self::StatefulSet => GroupVersionKind::gvk("apps", "v1", "StatefulSet"),
            Self::DaemonSet => GroupVersionKind::gvk("apps", "v1", "DaemonSet"),
            Self::Job => GroupVersionKind::gvk("batch", "v1", "Job"),
            Self::CronJob => GroupVersionKind::gvk("batch", "v1", "CronJob"),

            // Service & Networking Objects
            Self::Service => GroupVersionKind::gvk("", "v1", "Service"),
            Self::Ingress => GroupVersionKind::gvk("networking.k8s.io", "v1", "Ingress"),

            // Storage Objects
            Self::PersistentVolume => GroupVersionKind::gvk("", "v1", "PersistentVolume"),
            Self::PersistentVolumeClaim => GroupVersionKind::gvk("", "v1", "PersistentVolumeClaim"),

            // Configuration & Policy Objects
            Self::ConfigMap => GroupVersionKind::gvk("", "v1", "ConfigMap"),
            Self::Secret => GroupVersionKind::gvk("", "v1", "Secret"),
            Self::Namespace => GroupVersionKind::gvk("", "v1", "Namespace"),
            Self::Role => GroupVersionKind::gvk("rbac.authorization.k8s.io", "v1", "Role"),
            Self::ClusterRole => {
                GroupVersionKind::gvk("rbac.authorization.k8s.io", "v1", "ClusterRole")
            }
            Self::RoleBinding => {
                GroupVersionKind::gvk("rbac.authorization.k8s.io", "v1", "RoleBinding")
            }
            Self::ClusterRoleBinding => {
                GroupVersionKind::gvk("rbac.authorization.k8s.io", "v1", "ClusterRoleBinding")
            }
            Self::ServiceAccount => GroupVersionKind::gvk("", "v1", "ServiceAccount"),
        };

        let plural = match self {
            Self::Ingress => "ingresses",
            Self::CronJob => "cronjobs", // kube-rs might handle this but let's be safe
            _ => "",                     // Let kube-rs infer or we can be explicit.
                                          // Actually ApiResource::from_gvk doesn't take plural.
                                          // We need to construct ApiResource manually if we want to set plural.
        };

        // Simple pluralization for common cases if not specified
        let plural_string = if plural.is_empty() {
            format!("{}s", gvk.kind.to_ascii_lowercase())
        } else {
            plural.to_string()
        };

        let mut resource = ApiResource::from_gvk(&gvk);
        resource.plural = plural_string;
        resource
    }
}
