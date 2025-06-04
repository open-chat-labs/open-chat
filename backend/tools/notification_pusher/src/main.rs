use crate::config::Config;
use ic_agent::Identity;
use ic_agent::identity::{BasicIdentity, Secp256k1Identity};
use index_store::DummyStore;
use notification_pusher_lib::ic_agent::IcAgent;
use notification_pusher_lib::{run_notifications_pusher, write_metrics};
use std::fs;
use tokio::time;
use tracing::info;
use types::Error;
use web_push::VapidSignatureBuilder;

mod config;

#[tokio::main]
async fn main() -> Result<(), Error> {
    let config_file_path = std::env::args().nth(1).unwrap_or("./config.toml".to_string());

    let config = Config::from_file(&config_file_path)?;

    tracing_subscriber::fmt::SubscriberBuilder::default()
        .with_max_level(config.log_level)
        .init();

    info!("Starting...");

    let ic_identity_pem = fs::read(config.ic_identity_pem_file)?;
    let ic_identity = get_identity(&ic_identity_pem);
    let vapid_private_key_pem = fs::read(config.vapid_private_key_pem_file)?;
    let sig_builder = VapidSignatureBuilder::from_pem_no_sub(vapid_private_key_pem.as_slice())?;
    let index_store = build_index_store();
    let is_localhost = config.ic_url.contains("localhost") || config.ic_url.contains("127.0.0.1");
    let ic_agent = IcAgent::build(&config.ic_url, ic_identity, is_localhost).await?;

    info!("Configuration complete");

    tokio::spawn(write_metrics_to_file());

    run_notifications_pusher(
        ic_agent,
        config.notifications_index,
        index_store,
        sig_builder,
        config.pusher_threads,
        false,
    )
    .await;

    Ok(())
}

#[cfg(feature = "aws")]
fn build_index_store() -> DynamoDbIndexStore {
    let aws_config = aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await;
    dynamodb_index_store::DynamoDbIndexStore::build(&aws_config, "push_notification_stream_indexes".to_string())
}

#[cfg(not(feature = "aws"))]
fn build_index_store() -> DummyStore {
    DummyStore::default()
}

async fn write_metrics_to_file() {
    let mut interval = time::interval(time::Duration::from_secs(30));

    loop {
        interval.tick().await;

        let mut bytes = Vec::new();
        write_metrics(&mut bytes);

        std::fs::write("../../../metrics.md", bytes).unwrap();
    }
}

/// Returns an identity derived from the private key.
fn get_identity(pem: &[u8]) -> Box<dyn Identity + Sync + Send> {
    if let Ok(identity) = BasicIdentity::from_pem(pem) {
        Box::new(identity)
    } else if let Ok(identity) = Secp256k1Identity::from_pem(pem) {
        Box::new(identity)
    } else {
        panic!("Failed to create identity from pem");
    }
}
