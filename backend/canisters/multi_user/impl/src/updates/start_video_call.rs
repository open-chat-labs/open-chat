use crate::guards::caller_is_video_call_operator;
use crate::timer_job_types::{MarkVideoCallEndedJob, TimerJob};
use crate::updates::c2c_user_canister_v2::receive_start_video_call;
use crate::{MultiUserEventPusher, RuntimeState, mutate_state};
use canister_tracing_macros::trace;
use constants::HOUR_IN_MS;
use ic_cdk::update;
use oc_error_codes::OCErrorCode;
use rand::RngExt;
use types::{CallKind, MessageId, MessageIndex, Milliseconds, OCResult, UserId};
use user_canister::start_video_call_v2::*;
use user_canister::{StartVideoCallArgs, UserCanisterEvent};
use user_core::updates::start_video_call::{Started, notification, prepare};

// As in the User canister, the video call operator starts the call in the callee's copy of the
// chat, naming the callee since this canister holds many users, and the initiator's canister is
// told: directly if they are in this canister too
#[update(guard = "caller_is_video_call_operator")]
#[trace]
fn start_video_call_v2(args: Args) -> Response {
    mutate_state(|state| start_video_call_impl(args, state)).into()
}

fn start_video_call_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let Some(user_index) = state.index_of_local_user(args.user_id) else {
        return Err(OCErrorCode::TargetUserNotFound.into());
    };
    let sender = args.initiator;
    let my_user_id = args.user_id;
    let call_kind = state
        .data
        .users
        .with_user(user_index, |user| prepare(user, my_user_id, &args))
        .ok_or(OCErrorCode::TargetUserNotFound)??;
    let max_duration = args.max_duration.unwrap_or(HOUR_IN_MS);

    let Started {
        message_event,
        mute_notification,
    } = handle_start_video_call(
        user_index,
        args.message_id,
        None,
        sender,
        sender,
        call_kind,
        max_duration,
        state,
    );

    if !mute_notification {
        let now = state.env.now();
        state.push_notification(Some(sender), user_index, notification(&args, call_kind, &message_event), now);
    }

    let start_args = StartVideoCallArgs {
        message_id: args.message_id,
        message_index: message_event.event.message_index,
        max_duration: args.max_duration,
        audio_only: call_kind.audio_only(),
    };
    if let Some(their_index) = state.index_of_local_user(sender) {
        receive_start_video_call(start_args, my_user_id, their_index, state);
    } else {
        state.push_user_canister_event(user_index, sender, UserCanisterEvent::StartVideoCall(Box::new(start_args)));
    }
    Ok(())
}

// Records the call in the copy of the chat with `other` held by the user at `user_index`
#[expect(clippy::too_many_arguments)]
pub(crate) fn handle_start_video_call(
    user_index: u16,
    message_id: MessageId,
    their_message_index: Option<MessageIndex>,
    sender: UserId,
    other: UserId,
    call_kind: CallKind,
    max_duration: Milliseconds,
    state: &mut RuntimeState,
) -> Started {
    let now = state.env.now();
    let my_user_id = state.user_id(user_index);
    // Drawn up front, whether or not the chat turns out to need creating, since the user is
    // borrowed for the whole of the call below
    let anonymized_chat_id: u128 = state.env.rng().random();

    let event_pusher = MultiUserEventPusher {
        user_id: my_user_id,
        now,
        rng: state.env.rng(),
        queue: &mut state.data.local_user_index_event_sync_queue,
    };
    let started = state
        .data
        .users
        .with_user_mut(user_index, |user| {
            user_core::updates::start_video_call::handle_start_video_call(
                user,
                my_user_id,
                message_id,
                their_message_index,
                sender,
                other,
                call_kind,
                || anonymized_chat_id,
                Some(event_pusher),
                now,
            )
        })
        .expect("User not found");

    if let Some(expiry) = started.message_event.expires_at {
        state.handle_event_expiry(user_index, expiry);
    }

    state.data.timer_jobs.enqueue_job(
        TimerJob::MarkVideoCallEnded(MarkVideoCallEndedJob {
            user_index,
            them: other,
            message_id,
        }),
        now + max_duration,
        now,
    );

    started
}
