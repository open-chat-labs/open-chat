use bot_types::{
    access_token::BotCommandClaims,
    commands::{BadRequest, ExecuteCommandResponse},
};
use bot_utils::{
    env,
    jwt::{self},
};

use crate::{
    commands::greet::greet,
    commands::joke::joke,
    state::{self, State},
};

pub async fn execute_command(access_token: &str) -> ExecuteCommandResponse {
    let bot = match state::read(|state| prepare(access_token, state)) {
        Ok(c) => c,
        Err(bad_request) => return ExecuteCommandResponse::BadRequest(bad_request),
    };

    let result = match bot.command_name.as_str() {
        "greet" => greet(bot, access_token).await,
        "joke" => joke(bot, access_token).await,
        _ => return ExecuteCommandResponse::BadRequest(BadRequest::CommandNotFound),
    };

    match result {
        Ok(success) => ExecuteCommandResponse::Success(success),
        Err(internal_error) => ExecuteCommandResponse::InternalError(internal_error),
    }
}

fn prepare(access_token: &str, state: &State) -> Result<BotCommandClaims, BadRequest> {
    let oc_public_key_pem = state.oc_public_key();

    let claims = jwt::verify::<jwt::Claims<BotCommandClaims>>(access_token, oc_public_key_pem).map_err(|error| {
        ic_cdk::println!("Access token invalid: {:?}, error: {:?}", access_token, error);
        BadRequest::AccessTokenInvalid
    })?;

    if claims.exp_ms() < env::now() {
        return Err(BadRequest::AccessTokenExpired);
    }

    Ok(claims.into_custom())
}
