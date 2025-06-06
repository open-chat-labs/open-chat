use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_video_call_operator;
use crate::timer_job_types::TimerJob;
use crate::{CommunityEventPusher, RuntimeState, execute_update};
use canister_tracing_macros::trace;
use community_canister::end_video_call_v2::*;
use ic_cdk::update;
use oc_error_codes::OCErrorCode;
use types::OCResult;

#[update(guard = "caller_is_video_call_operator")]
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

    if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
        let now = state.env.now();
        let result = channel.chat.events.end_video_call(
            args.message_id.into(),
            now,
            Some(CommunityEventPusher {
                now,
                rng: state.env.rng(),
                queue: &mut state.data.local_user_index_event_sync_queue,
            }),
        )?;

        state.push_bot_notification(result.bot_notification);
        handle_activity_notification(state);
        Ok(())
    } else {
        Err(OCErrorCode::MessageNotFound.into())
    }
}
