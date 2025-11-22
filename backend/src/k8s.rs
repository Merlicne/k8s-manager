use kube::config::{Kubeconfig, KubeConfigOptions};
use kube::Client;
use std::error::Error;

pub async fn get_contexts() -> Result<Vec<String>, Box<dyn Error>> {
    let kubeconfig = Kubeconfig::read()?;
    let contexts = kubeconfig
        .contexts
        .into_iter()
        .map(|c| c.name)
        .collect();
    Ok(contexts)
}

pub async fn create_client(context_name: &str) -> Result<Client, Box<dyn Error>> {
    let kubeconfig = Kubeconfig::read()?;
    let options = KubeConfigOptions {
        context: Some(context_name.to_string()),
        ..Default::default()
    };
    
    let config = kube::Config::from_custom_kubeconfig(kubeconfig, &options).await?;
    let client = Client::try_from(config)?;
    Ok(client)
}
