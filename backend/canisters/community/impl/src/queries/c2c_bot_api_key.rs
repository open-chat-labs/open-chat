use crate::guards::caller_is_local_user_index;
use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query;
use community_canister::c2c_bot_api_key::*;
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

    if state.data.is_frozen() {
        return Frozen;
    }

    if state.data.is_owner(args.initiator.into(), args.channel_id) {
        return NotAuthorized;
    }

    let community_id = state.env.canister_id().into();

    let (api_key, scope) = match if let Some(channel_id) = args.channel_id {
        let Some(channel) = state.data.channels.get(&channel_id) else {
            return NotFound;
        };

        channel
            .bot_api_keys
            .get(&args.bot_id)
            .map(|api_key| (api_key, AccessTokenScope::Chat(Chat::Channel(community_id, channel_id))))
    } else {
        state
            .data
            .bot_api_keys
            .get(&args.bot_id)
            .map(|api_key| (api_key, AccessTokenScope::Community(community_id)))
    } {
        Some(p) => p,
        None => return NotFound,
    };

    let api_key_token = BotApiKeyToken {
        gateway: state.data.local_user_index_canister_id,
        bot_id: args.bot_id,
        scope,
        secret: api_key.secret.clone(),
    };

    let encoded_api_key = base64::from_value(&api_key_token);

    Success(encoded_api_key)
}
