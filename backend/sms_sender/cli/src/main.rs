use candid::Principal;
use index_store::DummyStore;
use sms_sender_aws::pinpoint::PinpointClient;
use sms_sender_core::{run, IcAgent, IcAgentConfig};
use std::collections::HashMap;
use std::str::FromStr;
use tracing::info;
use types::Error;

#[tokio::main]
async fn main() -> Result<(), Error> {
    dotenv::dotenv()?;
    tracing_subscriber::fmt::init();

    info!("Starting...");

    let args: Vec<String> = std::env::args().collect();
    let index = args[1].parse::<u64>().unwrap();

    let canister_id = Principal::from_text(dotenv::var("USER_INDEX_CANISTER_ID")?).unwrap();
    let index_store = DummyStore::new(HashMap::from([(canister_id, index)]));
    let ic_url = dotenv::var("IC_URL")?;
    let ic_identity_pem = dotenv::var("IC_IDENTITY_PEM")?;
    let is_production = bool::from_str(&dotenv::var("IS_PRODUCTION")?).unwrap();
    let pinpoint_application_id = dotenv::var("PINPOINT_APPLICATION_ID")?;

    let aws_config = aws_config::load_from_env().await;
    let pinpoint_client = PinpointClient::build(&aws_config, pinpoint_application_id);

    info!("DynamoDbClient created");

    let ic_agent_config = IcAgentConfig {
        ic_url,
        ic_identity_pem,
        fetch_root_key: !is_production,
        canister_id,
    };
    let ic_agent = IcAgent::build(&ic_agent_config).await?;

    info!("Configuration complete");

    run(canister_id, &ic_agent, &index_store, &pinpoint_client).await
}
