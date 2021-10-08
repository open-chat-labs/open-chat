use crate::dynamodb::DynamoDbClient;
use candid::Principal;
use shared::error::Error;
use shared::ic_agent::IcAgentConfig;
use shared::runner;
use shared::store::Store;
use slog::{info, o, Drain, Logger};
use std::str::FromStr;

mod dynamodb;

#[tokio::main]
async fn main() -> Result<(), Error> {
    dotenv::dotenv()?;
    let plain = slog_term::PlainSyncDecorator::new(std::io::stdout());
    let logger = Logger::root(slog_term::FullFormat::new(plain).build().fuse(), o!());

    info!(logger, "Starting...");

    let mut dynamodb_client: Box<dyn Store + Send + Sync> = Box::new(DynamoDbClient::build());

    info!(logger, "DynamoDbClient created");

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

    info!(logger, "Configuration complete");

    runner::run(
        ic_agent_config,
        canister_id,
        &mut dynamodb_client,
        &vapid_private_pem,
        &logger,
    )
    .await
}
