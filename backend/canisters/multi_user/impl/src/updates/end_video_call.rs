use crate::guards::caller_is_video_call_operator;
use crate::timer_job_types::TimerJob;
use crate::{MultiUserEventPusher, RuntimeState, mutate_state};
use canister_tracing_macros::trace;
use ic_cdk::update;
use oc_error_codes::OCErrorCode;
use types::{MessageId, OCResult, UserId};
use user_canister::end_video_call_v2::*;

// As in the User canister, the video call operator ends the call in one user's copy of the chat,
// naming the user since this canister holds many
#[update(guard = "caller_is_video_call_operator")]
#[trace]
fn end_video_call_v2(args: Args) -> Response {
    mutate_state(|state| {
        let Some(user_index) = state.index_of_local_user(args.user_id) else {
            return Err(OCErrorCode::TargetUserNotFound.into());
        };
        end_video_call_impl(user_index, args.them, args.message_id, state)
    })
    .into()
}

pub(crate) fn end_video_call_impl(user_index: u16, them: UserId, message_id: MessageId, state: &mut RuntimeState) -> OCResult {
    state.data.timer_jobs.cancel_job(|job| {
        if let TimerJob::MarkVideoCallEnded(vc) = job {
            vc.user_index == user_index && vc.them == them && vc.message_id == message_id
        } else {
            false
        }
    });

    let now = state.env.now();
    let my_user_id = state.user_id(user_index);
    let rng = state.env.rng();
    let queue = &mut state.data.local_user_index_event_sync_queue;
    let dismissal = state
        .data
        .users
        .with_user_mut(user_index, |user| {
            // As in the User canister, only the copy of the chat belonging to the user who started
            // the call pushes its end to the event store, so it is counted once
            user_core::updates::end_video_call(user, my_user_id, them, message_id, now, || MultiUserEventPusher {
                user_id: my_user_id,
                now,
                rng,
                queue,
            })
        })
        .expect("User not found")?;

    // whichever of this user's devices is still ringing for the call should stop
    if let Some(dismissal) = dismissal {
        state.push_notification(None, user_index, dismissal, now);
    }
    Ok(())
}
