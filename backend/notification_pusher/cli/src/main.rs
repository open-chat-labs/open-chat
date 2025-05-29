use candid::Principal;
use index_store::DummyStore;
use notification_pusher_core::ic_agent::IcAgent;
use notification_pusher_core::{run_notifications_pusher, write_metrics};
use std::collections::HashMap;
use std::str::FromStr;
use tokio::time;
use tracing::info;
use types::Error;

#[tokio::main]
async fn main() -> Result<(), Error> {
    dotenv::dotenv()?;
    tracing_subscriber::fmt::init();

    info!("Initializing notification pusher");

    let args: Vec<String> = std::env::args().collect();
    let index = args.get(1).map(|a| a.parse::<u64>().unwrap()).unwrap_or_default();
    let vapid_private_pem = read_env_var("VAPID_PRIVATE_PEM")?;
    let index_canister_id = Principal::from_text(read_env_var("NOTIFICATIONS_INDEX_CANISTER_ID")?)?;
    let notifications_canister_id = Principal::from_text(read_env_var("NOTIFICATIONS_CANISTER_ID")?)?;
    let index_store = DummyStore::new(HashMap::from([(notifications_canister_id, index)]));
    let ic_url = read_env_var("IC_URL")?;
    let ic_identity_pem = read_env_var("IC_IDENTITY_PEM")?;
    let is_production = bool::from_str(&read_env_var("IS_PRODUCTION")?).unwrap();
    let pusher_count = read_env_var("PUSHER_COUNT")
        .ok()
        .and_then(|s| u32::from_str(&s).ok())
        .unwrap_or(1);

    let ic_agent = IcAgent::build(&ic_url, &ic_identity_pem, !is_production).await?;

    info!("Initialization complete");

    tokio::spawn(write_metrics_to_file());

    run_notifications_pusher(
        ic_agent,
        index_canister_id,
        vec![notifications_canister_id],
        index_store,
        vapid_private_pem,
        pusher_count,
        is_production,
    )
    .await;

    Ok(())
}

fn read_env_var(name: &str) -> Result<String, String> {
    dotenv::var(name).map_err(|_| format!("Environment variable not found: {name}"))
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
