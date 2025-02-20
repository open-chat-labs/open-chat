use crate::guards::caller_is_local_user_index;
use crate::guards::caller_is_owner;
use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query;
use types::AccessTokenScope;
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
            return NotAuthorized;
        }

        api_key_impl(Args { bot_id: args.bot_id }, state)
    })
}

fn api_key_impl(args: Args, state: &RuntimeState) -> Response {
    let api_key = match state.data.bot_api_keys.get(&args.bot_id) {
        Some(api_key) => api_key,
        None => return NotFound,
    };

    let api_key_token = BotApiKeyToken {
        gateway: state.data.local_user_index_canister_id,
        bot_id: args.bot_id,
        scope: AccessTokenScope::Chat(Chat::Group(state.env.canister_id().into())),
        secret: api_key.secret.clone(),
    };

    let encoded_api_key = base64::from_value(&api_key_token);

    Success(encoded_api_key)
}
