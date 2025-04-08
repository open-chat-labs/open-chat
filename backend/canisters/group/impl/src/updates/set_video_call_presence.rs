use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::set_video_call_presence::{Response::*, *};
use oc_error_codes::OCError;
use types::Achievement;

#[update(msgpack = true)]
#[trace]
fn set_video_call_presence(args: Args) -> Response {
    run_regular_jobs();

    if let Err(error) = mutate_state(|state| set_video_call_presence_impl(args, state)) {
        Error(error)
    } else {
        Success
    }
}

pub(crate) fn set_video_call_presence_impl(args: Args, state: &mut RuntimeState) -> Result<(), OCError> {
    state.data.verify_not_frozen()?;

    let caller = state.env.caller();
    let member = state.data.get_verified_member(caller)?;
    let user_id = member.user_id();
    let now = state.env.now();

    let min_visible_event_index = state.data.chat.min_visible_event_index(Some(user_id))?;
    state
        .data
        .chat
        .events
        .set_video_call_presence(user_id, args.message_id, args.presence, min_visible_event_index, now)?;

    if args.new_achievement && !member.user_type().is_bot() {
        state.notify_user_of_achievement(user_id, Achievement::JoinedCall, now);
    }

    handle_activity_notification(state);
    Ok(())
}
