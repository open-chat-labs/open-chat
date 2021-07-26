mod actions;
mod dynamodb;
mod ic_agent;
mod sns;

use candid::CandidType;
use lambda_runtime::{handler_fn, Context, Error};
use serde::Deserialize;
use shared::types::CanisterId;
use std::env;

#[derive(Deserialize)]
struct Request {
    canister_id: CanisterId,
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

async fn my_handler(request: Request, _: Context) -> Result<(), Error> {
    match request.run_mode {
        Mode::PushNotifications => actions::push_messages::run(request.canister_id).await,
        Mode::PruneNotifications => actions::prune_messages::run(request.canister_id).await,
    }
}

pub fn read_env_var(name: &str) -> Result<String, Error> {
    env::var(name).map_err(|e| format!("Unable to read environment variable: {}. Error: {}", name, e).into())
}

#[derive(CandidType, Deserialize, Clone)]
pub struct ConfirmationCodeSms {
    pub phone_number: String,
    pub confirmation_code: String,
}
