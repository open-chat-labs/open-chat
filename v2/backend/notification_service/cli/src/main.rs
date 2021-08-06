use crate::dummy_store::DummyStore;
use candid::Principal;
use shared::actions::{prune_notifications, push_notifications};
use shared::error::Error;
use shared::ic_agent::IcAgentConfig;
use std::str::FromStr;

mod dummy_store;

#[tokio::main]
async fn main() -> Result<(), Error> {
    let args: Vec<String> = std::env::args().collect();
    let command: &str = &args[1];
    let index = args[2].parse::<u64>().unwrap();
    let store = Box::new(DummyStore::new(index));
    let vapid_private_pem = dotenv::var("VAPID_PRIVATE_PEM")?;
    let canister_id = Principal::from_text(dotenv::var("NOTIFICATIONS_CANISTER_ID")?)?;
    let ic_url = dotenv::var("IC_URL")?;
    let ic_identity_pem = dotenv::var("IC_IDENTITY_PEM")?;
    let is_production = bool::from_str(&dotenv::var("IS_PRODUCTION")?).unwrap();

    let ic_agent_config = IcAgentConfig {
        ic_url,
        ic_identity_pem,
        fetch_root_key: !is_production,
    };

    match command {
        "push" => push_notifications::run(ic_agent_config, canister_id, store, &vapid_private_pem).await,
        "remove" => prune_notifications::run(ic_agent_config, canister_id, store).await,
        _ => Err(format!("Unsupported command: {}", command).into()),
    }
}
