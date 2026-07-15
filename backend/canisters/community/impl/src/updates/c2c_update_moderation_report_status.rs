use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_user_index;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_update_moderation_report_status::*;
use oc_error_codes::OCErrorCode;
use types::OCResult;

#[update(guard = "caller_is_user_index", msgpack = true)]
#[trace]
fn c2c_update_moderation_report_status(args: Args) -> Response {
    execute_update(|state| c2c_update_moderation_report_status_impl(args, state)).into()
}

fn c2c_update_moderation_report_status_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let channel = state
        .data
        .channels
        .get_mut(&args.channel_id)
        .ok_or(OCErrorCode::ChatNotFound)?;
    let now = state.env.now();

    channel
        .chat
        .events
        .update_moderation_report_status(None, args.message_id, args.status, now)?;

    handle_activity_notification(state);
    Ok(())
}
