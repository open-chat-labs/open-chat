use crate::guards::caller_is_local_user_index;
use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query;
use group_canister::c2c_bot_api_key::*;
use types::AccessTokenScope;
use types::BotApiKeyToken;
use types::Chat;
use utils::base64;

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_bot_api_key(args: Args) -> Response {
    read_state(|state| c2c_bot_api_key_impl(args, state))
}

fn c2c_bot_api_key_impl(args: Args, state: &RuntimeState) -> Response {
    use types::c2c_bot_api_key::Response::*;

    if !state
        .data
        .get_member(args.initiator.into())
        .is_some_and(|member| member.role().is_owner())
    {
        return NotAuthorized;
    }

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
