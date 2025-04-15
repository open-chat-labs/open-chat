use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::set_video_call_presence::{Response::*, *};
use types::{Achievement, OCResult};

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

pub(crate) fn set_video_call_presence_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(false)?;
    let is_bot = member.user_type.is_bot();
    let now = state.env.now();
    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;

    channel
        .chat
        .set_video_call_presence(member.user_id, args.message_id, args.presence, now)?;

    if args.new_achievement && !is_bot {
        state.notify_user_of_achievement(member.user_id, Achievement::JoinedCall, now);
    }

    handle_activity_notification(state);
    Ok(())
}
