use crate::sns::SnsClient;
use candid::Principal;
use dynamodb_index_store::DynamoDbIndexStore;
use sms_sender_core::{run, IcAgent, IcAgentConfig};
use std::str::FromStr;
use tracing::info;
use types::Error;

mod sns;

#[tokio::main]
async fn main() -> Result<(), Error> {
    dotenv::dotenv()?;
    tracing::subscriber::set_global_default(tracing_subscriber::fmt::Subscriber::default())?;

    info!("Starting...");

    let canister_id = Principal::from_text(dotenv::var("USER_INDEX_CANISTER_ID")?).unwrap();
    let ic_url = dotenv::var("IC_URL")?;
    let ic_identity_pem = dotenv::var("IC_IDENTITY_PEM")?;
    let is_production = bool::from_str(&dotenv::var("IS_PRODUCTION")?).unwrap();

    let aws_config = aws_config::load_from_env().await;
    let dynamodb_index_store = DynamoDbIndexStore::build((&aws_config).into(), "sms_stream_indexes".to_string(), canister_id);
    let sns_client = SnsClient::build((&aws_config).into());

    info!("DynamoDbClient created");

    let ic_agent_config = IcAgentConfig {
        ic_url,
        ic_identity_pem,
        fetch_root_key: !is_production,
        canister_id,
    };
    let ic_agent = IcAgent::build(&ic_agent_config).await?;

    info!("Configuration complete");

    run(&ic_agent, &dynamodb_index_store, &sns_client).await
}
