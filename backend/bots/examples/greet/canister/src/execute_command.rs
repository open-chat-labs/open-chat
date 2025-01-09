use oc_bots_sdk::{
    api::{BadRequest, ExecuteCommandResponse},
    types::TokenError,
};
use oc_bots_sdk_canister::OpenChatClient;

use crate::{
    commands,
    state::{self},
};

pub async fn execute_command(jwt: &str) -> ExecuteCommandResponse {
    let public_key = state::read(|state| state.oc_public_key().to_string());

    let agent = match OpenChatClient::build(jwt.to_string(), &public_key) {
        Ok(a) => a,
        Err(bad_request) => match bad_request {
            TokenError::Invalid(_) => return ExecuteCommandResponse::BadRequest(BadRequest::AccessTokenInvalid),
            TokenError::Expired => return ExecuteCommandResponse::BadRequest(BadRequest::AccessTokenExpired),
        },
    };

    let result = match agent.claims().command_name.as_str() {
        "greet" => commands::greet(agent),
        "joke" => commands::joke(agent),
        _ => return ExecuteCommandResponse::BadRequest(BadRequest::CommandNotFound),
    };

    match result {
        Ok(success) => ExecuteCommandResponse::Success(success),
        Err(internal_error) => ExecuteCommandResponse::InternalError(internal_error),
    }
}
