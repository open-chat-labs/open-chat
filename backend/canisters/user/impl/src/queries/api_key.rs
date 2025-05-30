use crate::RuntimeState;
use crate::guards::caller_is_local_user_index;
use crate::guards::caller_is_owner;
use crate::read_state;
use canister_api_macros::query;
use oc_error_codes::OCErrorCode;
use types::AutonomousBotScope;
use types::BotApiKeyToken;
use types::Chat;
use user_canister::api_key::{Response::*, *};
use utils::base64;

#[query(guard = "caller_is_owner", msgpack = true)]
fn api_key(args: Args) -> Response {
    read_state(|state| api_key_impl(args, state))
}

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_bot_api_key(args: group_canister::c2c_bot_api_key::Args) -> Response {
    read_state(|state| {
        if state.env.canister_id() != args.initiator.into() {
            return Error(OCErrorCode::InitiatorNotAuthorized.into());
        }

        api_key_impl(Args { bot_id: args.bot_id }, state)
    })
}

fn api_key_impl(args: Args, state: &RuntimeState) -> Response {
    let api_key = match state.data.bot_api_keys.get(&args.bot_id) {
        Some(api_key) => api_key,
        None => return Error(OCErrorCode::ApiKeyNotFound.into()),
    };

    let api_key_token = BotApiKeyToken {
        gateway: state.data.local_user_index_canister_id,
        bot_id: args.bot_id,
        scope: AutonomousBotScope::Chat(Chat::Direct(state.env.canister_id().into())),
        secret: api_key.secret.clone(),
        permissions: api_key.granted_permissions.clone(),
    };

    let encoded_api_key = base64::from_value(&api_key_token);

    Success(encoded_api_key)
}
