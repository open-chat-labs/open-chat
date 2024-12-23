use canister_client::generate_candid_c2c_call;
use jwt::{verify_jwt, Claims};
use local_user_index_canister::execute_bot_command;
use serde::Serialize;
use types::{bot_actions::MessageContent, BotCommandClaims, HandleBotActionsError, MessageId};

use crate::{
    commands::greet::greet,
    env,
    state::{self, State},
};

pub enum ExecuteResponse {
    Success(SuccessResult),
    BadRequest(BadRequest),
    InternalError(InternalError),
}

#[derive(Serialize)]
pub struct SuccessResult {
    pub message: Option<Message>,
}

#[derive(Serialize)]
pub struct Message {
    pub id: MessageId,
    pub content: MessageContent,
}

#[derive(Serialize)]
pub enum BadRequest {
    AccessTokenNotFound,
    AccessTokenInvalid,
    AccessTokenExpired,
    CommandNotFound,
    ArgsInvalid,
}

#[derive(Serialize)]
pub enum InternalError {
    Invalid(String),
    CanisterError(HandleBotActionsError),
    C2CError(i32, String),
}

pub async fn execute(access_token: &str) -> ExecuteResponse {
    let bot = match state::read(|state| prepare(access_token, state)) {
        Ok(c) => c,
        Err(bad_request) => return ExecuteResponse::BadRequest(bad_request),
    };

    let result = match bot.command_name.as_str() {
        "greet" => greet(bot, access_token).await,
        _ => return ExecuteResponse::BadRequest(BadRequest::CommandNotFound),
    };

    match result {
        Ok(success) => ExecuteResponse::Success(success),
        Err(internal_error) => ExecuteResponse::InternalError(internal_error),
    }
}

fn prepare(access_token: &str, state: &State) -> Result<BotCommandClaims, BadRequest> {
    let oc_public_key_pem = state.oc_public_key();

    let claims = verify_jwt::<Claims<BotCommandClaims>>(access_token, oc_public_key_pem).map_err(|error| {
        ic_cdk::println!("Access token invalid: {:?}, error: {:?}", access_token, error);
        BadRequest::AccessTokenInvalid
    })?;

    if claims.exp_ms() < env::now() {
        return Err(BadRequest::AccessTokenExpired);
    }

    Ok(claims.into_custom())
}

generate_candid_c2c_call!(execute_bot_command);
