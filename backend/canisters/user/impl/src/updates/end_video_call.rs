use crate::guards::caller_is_video_call_operator;
use crate::timer_job_types::TimerJob;
use crate::{RuntimeState, UserEventPusher, execute_update};
use canister_tracing_macros::trace;
use ic_cdk::update;
use types::{OCResult, UserId};
use user_canister::end_video_call_v2::*;

#[update(guard = "caller_is_video_call_operator")]
#[trace]
fn end_video_call_v2(args: Args) -> Response {
    execute_update(|state| end_video_call_impl(args, state).into())
}

pub(crate) fn end_video_call_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.timer_jobs.cancel_job(|job| {
        if let TimerJob::MarkVideoCallEnded(vc) = job {
            vc.them == args.them && vc.message_id == args.message_id
        } else {
            false
        }
    });

    let now = state.env.now();
    let my_user_id: UserId = state.env.canister_id().into();
    let dismissal =
        user_core::updates::end_video_call(&mut state.data.user, my_user_id, args.them, args.message_id, now, || {
            UserEventPusher {
                now,
                rng: state.env.rng(),
                queue: &mut state.data.local_user_index_event_sync_queue,
            }
        })?;

    // whichever of this user's devices is still ringing for the call should stop
    if let Some(dismissal) = dismissal {
        state.push_notification(None, my_user_id, dismissal);
    }
    Ok(())
}
