mod dynamodb;

use crate::dynamodb::DynamoDbClient;
use candid::Principal;
use lambda_runtime::{handler_fn, Context};
use serde::Deserialize;
use shared::actions::{prune_notifications, push_notifications};
use shared::error::Error;
use std::env;

#[derive(Deserialize)]
struct Request {
    canister_id: Principal,
    run_mode: Mode,
}

#[derive(Deserialize)]
enum Mode {
    PushNotifications,
    PruneNotifications,
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    let func = handler_fn(my_handler);
    lambda_runtime::run(func).await?;
    Ok(())
}

#[rustfmt::skip]
async fn my_handler(request: Request, _: Context) -> Result<(), Error> {
    let dynamodb_client = Box::new(DynamoDbClient::build());
    let ic_identity_pem = read_env_var("IC_IDENTITY_PEM")?;
    let vapid_private_key = read_env_var("VAPID_PRIVATE_KEY")?;
    match request.run_mode {
        Mode::PushNotifications => push_notifications::run(
            request.canister_id, 
            dynamodb_client,
            ic_identity_pem,
            vapid_private_key).await,
        Mode::PruneNotifications => prune_notifications::run(
            request.canister_id, 
            dynamodb_client,
            ic_identity_pem).await,
    }
}

pub fn read_env_var(name: &str) -> Result<String, Error> {
    env::var(name).map_err(|e| format!("Unable to read environment variable: {}. Error: {}", name, e).into())
}
