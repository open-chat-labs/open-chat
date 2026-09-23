use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_video_call_operator;
use crate::timer_job_types::TimerJob;
use crate::{GroupEventPusher, RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::end_video_call_v2::*;
use types::{CallDismissalKind, OCResult, UserId};

#[update(guard = "caller_is_video_call_operator", candid = true, msgpack = true)]
#[trace]
fn end_video_call_v2(args: Args) -> Response {
    execute_update(|state| end_video_call_impl(args, state)).into()
}

pub(crate) fn end_video_call_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.timer_jobs.cancel_job(
        |job| {
            if let TimerJob::MarkVideoCallEnded(vc) = job { vc.0 == args } else { false }
        },
    );

    let now = state.env.now();
    let participants = state.data.chat.events.video_call_participants_of(args.message_id);
    let result = state.data.chat.events.end_video_call(
        args.message_id.into(),
        now,
        Some(GroupEventPusher {
            now,
            rng: state.env.rng(),
            queue: &mut state.data.local_user_index_event_sync_queue,
        }),
    )?;

    state.push_bot_notification(result.bot_notification);

    // stop the ring on every device: the participants' other devices as answered, everyone
    // else's as a call they missed
    let not_in_the_call: Vec<UserId> = state
        .data
        .chat
        .members
        .notifications_unmuted()
        .iter()
        .filter(|u| !participants.contains(u) && !state.data.chat.members.bots().contains_key(u))
        .copied()
        .collect();
    state.push_call_dismissal(args.message_id, CallDismissalKind::AnsweredElsewhere, participants);
    state.push_call_dismissal(args.message_id, CallDismissalKind::Ended, not_in_the_call);

    handle_activity_notification(state);
    Ok(())
}
