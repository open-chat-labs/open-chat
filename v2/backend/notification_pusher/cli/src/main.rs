use crate::dummy_store::DummyStore;
use candid::Principal;
use shared::actions::{prune_notifications, push_notifications};
use shared::error::Error;
use shared::ic_agent::IcAgentConfig;
use shared::runner;
use shared::store::Store;
use std::str::FromStr;

mod dummy_store;

#[tokio::main]
async fn main() -> Result<(), Error> {
    dotenv::dotenv()?;
    env_logger::init();
    let args: Vec<String> = std::env::args().collect();
    let command: &str = &args[1];
    let index = args[2].parse::<u64>().unwrap();
    let mut store: Box<dyn Store + Send + Sync> = Box::new(DummyStore::new(index));
    let vapid_private_pem = dotenv::var("VAPID_PRIVATE_PEM")?;
    let canister_id = Principal::from_text(dotenv::var("NOTIFICATIONS_CANISTER_ID")?)?;
    let ic_url = dotenv::var("IC_URL")?;
    let ic_identity_pem = dotenv::var("IC_IDENTITY_PEM")?;
    let is_development = bool::from_str(&dotenv::var("IS_DEVELOPMENT")?).unwrap();

    let ic_agent_config = IcAgentConfig {
        ic_url,
        ic_identity_pem,
        fetch_root_key: is_development,
    };

    match command {
        "push" => push_notifications::run(&ic_agent_config, canister_id, &mut store, &vapid_private_pem).await,
        "prune" => prune_notifications::run(&ic_agent_config, canister_id, &mut store).await,
        "auto" => runner::run(ic_agent_config, canister_id, &mut store, &vapid_private_pem).await,
        _ => Err(format!("Unsupported command: {}", command).into()),
    }
}
