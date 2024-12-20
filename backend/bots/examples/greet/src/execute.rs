use canister_client::generate_c2c_call;
use jwt::{verify_jwt, Claims};
use local_user_index_canister::execute_bot_command;
use serde::Serialize;
use types::{BotCommandClaims, HandleBotActionsError};

use crate::{
    commands::greet::greet,
    env,
    state::{self, State},
};

pub enum ExecuteResponse {
    Success,
    BadRequest(BadRequest),
    InternalError(InternalError),
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
        Err(response) => return response,
    };

    if let Err(internal_error) = match bot.command_name.as_str() {
        "greet" => {
            // greet takes no args
            if !bot.command_args.is_empty() {
                return ExecuteResponse::BadRequest(BadRequest::ArgsInvalid);
            }

            greet(bot, access_token).await
        }
        _ => return ExecuteResponse::BadRequest(BadRequest::CommandNotFound),
    } {
        return ExecuteResponse::InternalError(internal_error);
    };

    ExecuteResponse::Success
}

fn prepare(access_token: &str, state: &State) -> Result<BotCommandClaims, ExecuteResponse> {
    let oc_public_key_pem = state.oc_public_key();

    let claims = verify_jwt::<Claims<BotCommandClaims>>(access_token, oc_public_key_pem).map_err(|error| {
        ic_cdk::println!("Access token invalid: {:?}, error: {:?}", access_token, error);
        ExecuteResponse::BadRequest(BadRequest::AccessTokenInvalid)
    })?;

    if claims.exp_ms() < env::now() {
        return Err(ExecuteResponse::BadRequest(BadRequest::AccessTokenExpired));
    }

    Ok(claims.into_custom())
}

generate_c2c_call!(execute_bot_command);
