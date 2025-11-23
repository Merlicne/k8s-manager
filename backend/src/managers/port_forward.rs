use std::collections::HashMap;
use std::process::{Child, Command};
use std::sync::{Arc, Mutex};
use serde::Serialize;
use uuid::Uuid;

#[derive(Clone, Serialize)]
pub struct PortForwardInfo {
    pub id: String,
    pub context: String,
    pub namespace: String,
    pub service_name: String,
    pub service_port: u16,
    pub local_port: u16,
    pub pid: u32,
}

#[derive(Clone)]
pub struct PortForwardManager {
    processes: Arc<Mutex<HashMap<u16, (Child, PortForwardInfo)>>>,
}

impl PortForwardManager {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn start_forward(
        &self,
        context: &str,
        namespace: &str,
        resource_type: &str,
        resource_name: &str,
        local_port: u16,
        remote_port: u16,
    ) -> Result<PortForwardInfo, String> {
        let mut processes = self.processes.lock().unwrap();

        if processes.contains_key(&local_port) {
            return Err(format!("Port {} is already in use by another forward", local_port));
        }

        // Construct kubectl command
        // kubectl port-forward --context=ctx -n ns type/name local:remote
        let child = Command::new("kubectl")
            .arg("port-forward")
            .arg(format!("--context={}", context))
            .arg(format!("--namespace={}", namespace))
            .arg(format!("{}/{}", resource_type, resource_name))
            .arg(format!("{}:{}", local_port, remote_port))
            .spawn()
            .map_err(|e| format!("Failed to spawn kubectl: {}", e))?;

        let info = PortForwardInfo {
            id: Uuid::new_v4().to_string(),
            context: context.to_string(),
            namespace: namespace.to_string(),
            service_name: resource_name.to_string(),
            service_port: remote_port,
            local_port,
            pid: child.id(),
        };

        processes.insert(local_port, (child, info.clone()));
        Ok(info)
    }

    pub fn stop_forward(&self, local_port: u16) -> Result<(), String> {
        let mut processes = self.processes.lock().unwrap();

        if let Some((mut child, _)) = processes.remove(&local_port) {
            child.kill().map_err(|e| format!("Failed to kill process: {}", e))?;
            return Ok(());
        }

        Err(format!("No active forward found on port {}", local_port))
    }

    pub fn list_forwards(&self) -> Vec<PortForwardInfo> {
        let processes = self.processes.lock().unwrap();
        processes.values().map(|(_, info)| info.clone()).collect()
    }
}
