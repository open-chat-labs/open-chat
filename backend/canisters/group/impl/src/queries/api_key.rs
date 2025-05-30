use crate::RuntimeState;
use crate::guards::caller_is_local_user_index;
use crate::read_state;
use candid::Principal;
use canister_api_macros::query;
use group_canister::api_key::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::BotApiKeyToken;
use types::Chat;
use types::{AutonomousBotScope, OCResult};
use utils::base64;

#[query(msgpack = true)]
fn api_key(args: Args) -> Response {
    match read_state(|state| api_key_impl(args, state.env.caller(), state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_bot_api_key(args: group_canister::c2c_bot_api_key::Args) -> Response {
    let initiator = args.initiator.into();
    match read_state(|state| api_key_impl(Args { bot_id: args.bot_id }, initiator, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn api_key_impl(args: Args, caller: Principal, state: &RuntimeState) -> OCResult<String> {
    if !state.data.get_member(caller).is_some_and(|member| member.role().is_owner()) {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let api_key = match state.data.bot_api_keys.get(&args.bot_id) {
        Some(api_key) => api_key,
        None => return Err(OCErrorCode::ApiKeyNotFound.into()),
    };

    let api_key_token = BotApiKeyToken {
        gateway: state.data.local_user_index_canister_id,
        bot_id: args.bot_id,
        scope: AutonomousBotScope::Chat(Chat::Group(state.env.canister_id().into())),
        secret: api_key.secret.clone(),
        permissions: api_key.granted_permissions.clone(),
    };

    let encoded_api_key = base64::from_value(&api_key_token);

    Ok(encoded_api_key)
}
