use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, activity_notifications::handle_activity_notification, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::OPENCHAT_BOT_USER_ID;
use oc_error_codes::OCErrorCode;
use types::{OCResult, c2c_uninstall_bot::*};

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_uninstall_bot(args: Args) -> Response {
    execute_update(|state| c2c_uninstall_bot_impl(args, state)).into()
}

fn c2c_uninstall_bot_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    if args.caller != OPENCHAT_BOT_USER_ID {
        let member = state.data.chat.members.get_verified_member(args.caller)?;
        if !member.role().is_owner() {
            return Err(OCErrorCode::InitiatorNotAuthorized.into());
        }
    }

    let now = state.env.now();

    state.data.uninstall_bot(args.caller, args.bot_id, now);

    handle_activity_notification(state);
    Ok(())
}
