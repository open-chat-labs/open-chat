use aws_config::BehaviorVersion;
use candid::Principal;
use dynamodb_index_store::DynamoDbIndexStore;
use notification_pusher_core::ic_agent::IcAgent;
use notification_pusher_core::{run_notifications_pusher, write_metrics};
use std::str::FromStr;
use tokio::time;
use tracing::info;
use types::Error;

#[tokio::main]
async fn main() -> Result<(), Error> {
    dotenv::dotenv()?;
    tracing_subscriber::fmt::init();

    info!("Starting...");

    let vapid_private_pem = dotenv::var("VAPID_PRIVATE_PEM")?;
    let index_canister_id = Principal::from_text(dotenv::var("NOTIFICATIONS_INDEX_CANISTER_ID")?).unwrap();
    let notifications_canister_ids_string = dotenv::var("NOTIFICATIONS_CANISTER_IDS")?;
    let ic_url = dotenv::var("IC_URL")?;
    let ic_identity_pem = dotenv::var("IC_IDENTITY_PEM")?;
    let is_production = bool::from_str(&dotenv::var("IS_PRODUCTION")?).unwrap();
    let pusher_count = dotenv::var("PUSHER_COUNT")
        .ok()
        .and_then(|s| u32::from_str(&s).ok())
        .unwrap_or(10);

    let aws_config = aws_config::load_defaults(BehaviorVersion::latest()).await;
    let dynamodb_index_store = DynamoDbIndexStore::build(&aws_config, "push_notification_stream_indexes".to_string());

    info!("DynamoDbClient created");

    let ic_agent = IcAgent::build(&ic_url, &ic_identity_pem, !is_production).await?;

    info!("Configuration complete");

    let notifications_canister_ids: Vec<_> = notifications_canister_ids_string
        .split(';')
        .map(|str| Principal::from_text(str).unwrap())
        .collect();

    tokio::spawn(write_metrics_to_file());

    run_notifications_pusher(
        ic_agent,
        index_canister_id,
        notifications_canister_ids,
        dynamodb_index_store,
        vapid_private_pem,
        pusher_count,
    )
    .await;

    Ok(())
}

async fn write_metrics_to_file() {
    let mut interval = time::interval(time::Duration::from_secs(30));

    loop {
        interval.tick().await;

        let mut bytes = Vec::new();
        write_metrics(&mut bytes);

        std::fs::write("metrics.md", bytes).unwrap();
    }
}
