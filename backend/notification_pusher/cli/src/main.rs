use candid::Principal;
use index_store::DummyStore;
use notification_pusher_core::ic_agent::IcAgent;
use notification_pusher_core::run_notifications_pusher;
use std::collections::HashMap;
use std::str::FromStr;
use tracing::info;
use types::Error;

#[tokio::main]
async fn main() -> Result<(), Error> {
    dotenv::dotenv()?;
    tracing_subscriber::fmt::init();

    info!("Initializing notification pusher");

    let args: Vec<String> = std::env::args().collect();
    let index = args[1].parse::<u64>().unwrap();
    let vapid_private_pem = dotenv::var("VAPID_PRIVATE_PEM")?;
    let index_canister_id = Principal::from_text(dotenv::var("NOTIFICATIONS_INDEX_CANISTER_ID")?)?;
    let notifications_canister_id = Principal::from_text(dotenv::var("NOTIFICATIONS_CANISTER_ID")?)?;
    let index_store = DummyStore::new(HashMap::from([(notifications_canister_id, index)]));
    let ic_url = dotenv::var("IC_URL")?;
    let ic_identity_pem = dotenv::var("IC_IDENTITY_PEM")?;
    let is_production = bool::from_str(&dotenv::var("IS_PRODUCTION")?).unwrap();

    let ic_agent = IcAgent::build(&ic_url, &ic_identity_pem, !is_production).await?;

    info!("Initialization complete");

    run_notifications_pusher(
        ic_agent,
        index_canister_id,
        vec![notifications_canister_id],
        index_store,
        vapid_private_pem,
        1,
    )
    .await;

    Ok(())
}
