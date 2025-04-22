use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::OPENCHAT_BOT_USER_ID;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use types::c2c_uninstall_bot::*;

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_uninstall_bot(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_uninstall_bot_impl(args, state)).into()
}

fn c2c_uninstall_bot_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    if args.caller != OPENCHAT_BOT_USER_ID {
        let member = state.data.members.get_verified_member(args.caller.into())?;
        if !member.role().is_owner() {
            return Err(OCErrorCode::InitiatorNotAuthorized.into());
        }
    }

    state.data.uninstall_bot(args.caller, args.bot_id, state.env.now());

    handle_activity_notification(state);
    Ok(())
}
