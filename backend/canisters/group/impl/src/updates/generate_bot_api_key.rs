use crate::activity_notifications::handle_activity_notification;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::generate_bot_api_key::{Response::*, *};
use installed_bots::GenerateApiKeyResult;
use oc_error_codes::OCErrorCode;
use types::{AutonomousBotScope, BotApiKeyToken, Chat, OCResult};
use utils::base64;

#[update(msgpack = true)]
#[trace]
fn generate_bot_api_key(args: Args) -> Response {
    match execute_update(|state| generate_bot_api_key_impl(args, state)) {
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
    let GenerateApiKeyResult { new_key, old_key: _ } =
        state
            .data
            .bot_api_keys
            .generate(args.bot_id, args.requested_permissions.clone(), now, state.env.rng());

    state.data.chat.events.unsubscribe_bot_from_events(args.bot_id);

    let api_key_token = BotApiKeyToken {
        gateway: state.data.local_user_index_canister_id,
        bot_id: args.bot_id,
        scope: AutonomousBotScope::Chat(Chat::Group(state.env.canister_id().into())),
        secret: new_key,
        permissions: args.requested_permissions,
    };

    let api_key = base64::from_value(&api_key_token);

    handle_activity_notification(state);

    Ok(SuccessResult { api_key })
}
