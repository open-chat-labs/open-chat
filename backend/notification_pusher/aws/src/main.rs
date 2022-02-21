use candid::Principal;
use dynamodb_index_store::DynamoDbIndexStore;
use notification_pusher_core::ic_agent::IcAgentConfig;
use notification_pusher_core::runner;
use std::str::FromStr;
use tracing::info;
use types::Error;

#[tokio::main]
async fn main() -> Result<(), Error> {
    dotenv::dotenv()?;
    tracing_subscriber::fmt::init();

    info!("Starting...");

    let vapid_private_pem = dotenv::var("VAPID_PRIVATE_PEM")?;
    let canister_id = Principal::from_text(dotenv::var("NOTIFICATIONS_CANISTER_ID")?).unwrap();
    let ic_url = dotenv::var("IC_URL")?;
    let ic_identity_pem = dotenv::var("IC_IDENTITY_PEM")?;
    let is_production = bool::from_str(&dotenv::var("IS_PRODUCTION")?).unwrap();

    let aws_config = aws_config::load_from_env().await;
    let dynamodb_index_store =
        DynamoDbIndexStore::build(&aws_config, "push_notification_stream_indexes".to_string(), canister_id);

    info!("DynamoDbClient created");

    let ic_agent_config = IcAgentConfig {
        ic_url,
        ic_identity_pem,
        fetch_root_key: !is_production,
        canister_id,
    };

    info!("Configuration complete");

    runner::run(ic_agent_config, &dynamodb_index_store, &vapid_private_pem).await
}
