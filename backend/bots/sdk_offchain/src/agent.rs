use ic_agent::identity::{BasicIdentity, Secp256k1Identity};
use ic_agent::{Agent, Identity};
use std::path::{Path, PathBuf};

pub async fn build(url: String, dfx_identity: &str) -> Agent {
    let identity = get_dfx_identity(dfx_identity);
    let mainnet = is_mainnet(&url);
    let timeout = std::time::Duration::from_secs(60 * 5);

    let agent = Agent::builder()
        .with_url(url)
        .with_boxed_identity(identity)
        .with_ingress_expiry(timeout)
        .build()
        .expect("Failed to build IC agent");

    if !mainnet {
        agent.fetch_root_key().await.expect("Couldn't fetch root key");
    }

    agent
}

fn get_user_dfx_config_dir() -> Option<PathBuf> {
    let config_root = std::env::var_os("DFX_CONFIG_ROOT");
    let home = std::env::var_os("HOME")?;
    let root = config_root.unwrap_or(home);
    Some(PathBuf::from(root).join(".config").join("dfx"))
}

fn is_mainnet(url: &str) -> bool {
    url.contains("ic0.app")
}

fn get_dfx_identity(name: &str) -> Box<dyn Identity> {
    let config_dfx_dir_path = get_user_dfx_config_dir().unwrap();
    let pem_path = config_dfx_dir_path.join("identity").join(name).join("identity.pem");
    if !Path::exists(pem_path.as_path()) {
        panic!("Pem file not found at: {}", pem_path.as_path().display());
    }
    if let Ok(identity) = BasicIdentity::from_pem_file(pem_path.as_path()) {
        Box::new(identity)
    } else if let Ok(identity) = Secp256k1Identity::from_pem_file(pem_path.as_path()) {
        Box::new(identity)
    } else {
        panic!("Failed to create identity from pem file: {}", pem_path.as_path().display());
    }
}
