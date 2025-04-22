use crate::activity_notifications::handle_activity_notification;
use crate::{RuntimeState, mutate_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::generate_bot_api_key::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::{AccessTokenScope, BotApiKeyToken, Chat, OCResult};
use utils::base64;

#[update(msgpack = true)]
#[trace]
fn generate_bot_api_key(args: Args) -> Response {
    run_regular_jobs();

    match mutate_state(|state| generate_bot_api_key_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn generate_bot_api_key_impl(args: Args, state: &mut RuntimeState) -> OCResult<SuccessResult> {
    state.data.verify_not_frozen()?;

    if state.data.bots.get(&args.bot_id).is_none() {
        return Err(OCErrorCode::BotNotFound.into());
    };

    let member = state.get_calling_member(true)?;

    if !member.role().is_owner() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let now = state.env.now();
    let api_key_secret =
        state
            .data
            .bot_api_keys
            .generate(args.bot_id, args.requested_permissions.clone(), now, state.env.rng());

    let api_key_token = BotApiKeyToken {
        gateway: state.data.local_user_index_canister_id,
        bot_id: args.bot_id,
        scope: AccessTokenScope::Chat(Chat::Group(state.env.canister_id().into())),
        secret: api_key_secret,
        permissions: args.requested_permissions,
    };

    let api_key = base64::from_value(&api_key_token);

    handle_activity_notification(state);

    Ok(SuccessResult { api_key })
}
