use crate::RuntimeState;
use crate::guards::caller_is_local_user_index;
use crate::read_state;
use candid::Principal;
use canister_api_macros::query;
use community_canister::api_key::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::BotApiKeyToken;
use types::Chat;
use types::GroupRole;
use types::{AccessTokenScope, OCResult};
use utils::base64;

#[query(msgpack = true)]
fn api_key(args: Args) -> Response {
    match read_state(|state| api_key_impl(args, state.env.caller(), state)) {
        Ok(api_key) => Success(api_key),
        Err(error) => Error(error),
    }
}

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_bot_api_key(args: community_canister::c2c_bot_api_key::Args) -> Response {
    let initiator = args.initiator.into();
    match read_state(|state| api_key_impl(args.into(), initiator, state)) {
        Ok(api_key) => Success(api_key),
        Err(error) => Error(error),
    }
}

fn api_key_impl(args: Args, caller: Principal, state: &RuntimeState) -> OCResult<String> {
    if !state.data.is_same_or_senior(caller, args.channel_id, GroupRole::Owner) {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let community_id = state.env.canister_id().into();

    let (api_key, scope) = match if let Some(channel_id) = args.channel_id {
        let channel = state.data.channels.get_or_err(&channel_id)?;

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
        None => return Err(OCErrorCode::ApiKeyNotFound.into()),
    };

    let api_key_token = BotApiKeyToken {
        gateway: state.data.local_user_index_canister_id,
        bot_id: args.bot_id,
        scope,
        secret: api_key.secret.clone(),
        permissions: api_key.granted_permissions.clone(),
    };

    let encoded_api_key = base64::from_value(&api_key_token);

    Ok(encoded_api_key)
}
