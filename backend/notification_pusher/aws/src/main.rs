use candid::Principal;
use dynamodb_index_store::DynamoDbIndexStore;
use notification_pusher_core::ic_agent::IcAgent;
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
    let index_canister_id = Principal::from_text(dotenv::var("NOTIFICATIONS_INDEX_CANISTER_ID")?).unwrap();
    let notifications_canister_ids_string = dotenv::var("NOTIFICATIONS_CANISTER_IDS")?;
    let ic_url = dotenv::var("IC_URL")?;
    let ic_identity_pem = dotenv::var("IC_IDENTITY_PEM")?;
    let is_production = bool::from_str(&dotenv::var("IS_PRODUCTION")?).unwrap();

    let aws_config = aws_config::load_from_env().await;
    let dynamodb_index_store = DynamoDbIndexStore::build(&aws_config, "push_notification_stream_indexes".to_string());

    info!("DynamoDbClient created");

    let ic_agent = IcAgent::build(&ic_url, &ic_identity_pem, !is_production).await?;

    info!("Configuration complete");

    let futures: Vec<_> = notifications_canister_ids_string
        .split(';')
        .map(|str| Principal::from_text(str).unwrap())
        .map(|notifications_canister_id| {
            runner::run(
                &ic_agent,
                index_canister_id,
                notifications_canister_id,
                &dynamodb_index_store,
                &vapid_private_pem,
            )
        })
        .collect();

    futures::future::join_all(futures).await;
    Ok(())
}
