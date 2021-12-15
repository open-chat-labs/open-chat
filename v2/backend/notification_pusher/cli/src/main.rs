use candid::Principal;
use index_store::DummyStore;
use notification_pusher_core::actions::{prune_notifications, push_notifications};
use notification_pusher_core::ic_agent::IcAgentConfig;
use notification_pusher_core::runner;
use std::str::FromStr;
use types::Error;

#[tokio::main]
async fn main() -> Result<(), Error> {
    dotenv::dotenv()?;

    let args: Vec<String> = std::env::args().collect();
    let command: &str = &args[1];
    let index = args[2].parse::<u64>().unwrap();
    let index_store = DummyStore::new(Some(index));
    let vapid_private_pem = dotenv::var("VAPID_PRIVATE_PEM")?;
    let canister_id = Principal::from_text(dotenv::var("NOTIFICATIONS_CANISTER_ID")?)?;
    let ic_url = dotenv::var("IC_URL")?;
    let ic_identity_pem = dotenv::var("IC_IDENTITY_PEM")?;
    let is_production = bool::from_str(&dotenv::var("IS_PRODUCTION")?).unwrap();

    let ic_agent_config = IcAgentConfig {
        ic_url,
        ic_identity_pem,
        fetch_root_key: !is_production,
        canister_id,
    };

    match command {
        "push" => push_notifications::run(&ic_agent_config, &index_store, &vapid_private_pem).await,
        "prune" => prune_notifications::run(&ic_agent_config, &index_store).await,
        "auto" => runner::run(ic_agent_config, &index_store, &vapid_private_pem).await,
        _ => Err(format!("Unsupported command: {}", command).into()),
    }
}
