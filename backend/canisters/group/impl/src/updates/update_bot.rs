use crate::{RuntimeState, activity_notifications::handle_activity_notification, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::update_bot::*;
use oc_error_codes::OCErrorCode;
use types::OCResult;

#[update(msgpack = true)]
#[trace]
fn update_bot(args: Args) -> Response {
    execute_update(|state| update_bot_impl(args, state)).into()
}

fn update_bot_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;

    if !member.role().is_owner() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    if !state.data.update_bot(
        member.user_id(),
        args.bot_id,
        args.granted_permissions,
        args.granted_autonomous_permissions,
        state.env.now(),
    ) {
        return Err(OCErrorCode::BotNotFound.into());
    }

    handle_activity_notification(state);
    Ok(())
}
