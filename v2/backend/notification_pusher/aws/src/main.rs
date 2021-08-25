use crate::dynamodb::DynamoDbClient;
use candid::Principal;
use log::info;
use shared::error::Error;
use shared::ic_agent::IcAgentConfig;
use shared::runner;
use shared::store::Store;
use std::str::FromStr;

mod dynamodb;

#[tokio::main]
async fn main() -> Result<(), Error> {
    dotenv::dotenv()?;
    env_logger::init();
    info!("Starting...");

    let mut dynamodb_client: Box<dyn Store + Send + Sync> = Box::new(DynamoDbClient::build());
    let vapid_private_pem = dotenv::var("VAPID_PRIVATE_PEM")?;
    let canister_id = Principal::from_text(dotenv::var("NOTIFICATIONS_CANISTER_ID")?).unwrap();
    let ic_url = dotenv::var("IC_URL")?;
    let ic_identity_pem = dotenv::var("IC_IDENTITY_PEM")?;
    let is_production = bool::from_str(&dotenv::var("IS_PRODUCTION")?).unwrap();

    let ic_agent_config = IcAgentConfig {
        ic_url,
        ic_identity_pem,
        fetch_root_key: !is_production,
    };

    info!("Configuration complete");

    runner::run(ic_agent_config, canister_id, &mut dynamodb_client, &vapid_private_pem).await
}
