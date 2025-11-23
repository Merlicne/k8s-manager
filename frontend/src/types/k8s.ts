export const K8sResourceType = {
  // Workload and Compute Objects
  Pod: "Pod",
  Deployment: "Deployment",
  ReplicaSet: "ReplicaSet",
  StatefulSet: "StatefulSet",
  DaemonSet: "DaemonSet",
  Job: "Job",
  CronJob: "CronJob",

  // Service & Networking Objects
  Service: "Service",
  Ingress: "Ingress",

  // Storage Objects
  PersistentVolume: "PersistentVolume",
  PersistentVolumeClaim: "PersistentVolumeClaim",

  // Configuration & Policy Objects
  ConfigMap: "ConfigMap",
  Secret: "Secret",
  Namespace: "Namespace",
  Role: "Role",
  ClusterRole: "ClusterRole",
  RoleBinding: "RoleBinding",
  ClusterRoleBinding: "ClusterRoleBinding",
  ServiceAccount: "ServiceAccount",
} as const;

export type K8sResourceType = typeof K8sResourceType[keyof typeof K8sResourceType];

export interface Pod {
  name: string;
  namespace: string;
  status: string;
  node?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  resource_type: string;
  data: any;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
