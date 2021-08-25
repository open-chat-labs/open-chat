use crate::dynamodb::DynamoDbClient;
use candid::Principal;
use lambda_runtime::{handler_fn, Context};
use serde::Deserialize;
use shared::actions::{prune_notifications, push_notifications};
use shared::error::Error;
use shared::ic_agent::IcAgentConfig;
use shared::store::Store;
use std::env;
use std::str::FromStr;

mod dynamodb;

#[derive(Deserialize)]
struct Request {
    run_mode: Mode,
}

#[derive(Deserialize)]
enum Mode {
    PushNotifications,
    PruneNotifications,
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    env_logger::init();
    let func = handler_fn(my_handler);
    lambda_runtime::run(func).await?;
    Ok(())
}

#[rustfmt::skip]
async fn my_handler(request: Request, _: Context) -> Result<(), Error> {
    let mut dynamodb_client: Box<dyn Store + Send + Sync> = Box::new(DynamoDbClient::build());
    let vapid_private_pem = read_env_var("VAPID_PRIVATE_PEM")?;
    let canister_id = Principal::from_text(read_env_var("NOTIFICATIONS_CANISTER_ID")?).unwrap();
    let ic_url = read_env_var("IC_URL")?;
    let ic_identity_pem = read_env_var("IC_IDENTITY_PEM")?;
    let is_production = bool::from_str(&read_env_var("IS_PRODUCTION")?).unwrap();

    let ic_agent_config =  IcAgentConfig {
        ic_url,
        ic_identity_pem,
        fetch_root_key: !is_production,
    };

    match request.run_mode {
        Mode::PushNotifications => push_notifications::run(
            &ic_agent_config,
            canister_id, 
            &mut dynamodb_client,
            &vapid_private_pem).await,
        Mode::PruneNotifications => prune_notifications::run(
            &ic_agent_config,
            canister_id, 
            &mut dynamodb_client).await,
    }
}

pub fn read_env_var(name: &str) -> Result<String, Error> {
    env::var(name).map_err(|e| format!("Unable to read environment variable: {}. Error: {}", name, e).into())
}
