use crate::guards::caller_is_video_call_operator;
use crate::timer_job_types::{MarkVideoCallEndedJob, TimerJob};
use crate::{RuntimeState, UserEventPusher, execute_update};
use canister_tracing_macros::trace;
use constants::HOUR_IN_MS;
use ic_cdk::update;
use rand::RngExt;
use types::{CallKind, EventWrapper, Message, MessageId, MessageIndex, Milliseconds, OCResult, UserId};
use user_canister::start_video_call_v2::*;
use user_canister::{StartVideoCallArgs, UserCanisterEvent};
use user_core::updates::start_video_call::{Started, notification, prepare};

#[update(guard = "caller_is_video_call_operator")]
#[trace]
fn start_video_call_v2(args: Args) -> Response {
    execute_update(|state| start_video_call_impl(args, state)).into()
}

fn start_video_call_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let sender = args.initiator;
    let my_user_id = state.env.canister_id().into();
    let call_kind = prepare(&state.data.user, my_user_id, &args)?;
    let max_duration = args.max_duration.unwrap_or(HOUR_IN_MS);

    let StartVideoCallResult {
        message_event,
        mute_notification,
    } = handle_start_video_call(args.message_id, None, sender, sender, call_kind, max_duration, state);

    if !mute_notification {
        state.push_notification(Some(sender), my_user_id, notification(&args, call_kind, &message_event));
    }

    state.push_user_canister_event(
        sender,
        UserCanisterEvent::StartVideoCall(Box::new(StartVideoCallArgs {
            message_id: args.message_id,
            message_index: message_event.event.message_index,
            max_duration: args.max_duration,
            audio_only: call_kind.audio_only(),
        })),
    );
    Ok(())
}

pub fn handle_start_video_call(
    message_id: MessageId,
    their_message_index: Option<MessageIndex>,
    sender: UserId,
    other: UserId,
    call_kind: CallKind,
    max_duration: Milliseconds,
    state: &mut RuntimeState,
) -> StartVideoCallResult {
    let now = state.env.now();
    let my_user_id = state.env.canister_id().into();
    // Drawn up front, whether or not the chat turns out to need creating, since the rng is also
    // borrowed by the event pusher
    let anonymized_chat_id: u128 = state.env.rng().random();

    let Started {
        message_event,
        mute_notification,
    } = user_core::updates::start_video_call::handle_start_video_call(
        &mut state.data.user,
        my_user_id,
        message_id,
        their_message_index,
        sender,
        other,
        call_kind,
        || anonymized_chat_id,
        Some(UserEventPusher {
            now,
            rng: state.env.rng(),
            queue: &mut state.data.local_user_index_event_sync_queue,
        }),
        now,
    );

    if let Some(expiry) = message_event.expires_at {
        state.data.handle_event_expiry(expiry, now);
    }

    state.data.timer_jobs.enqueue_job(
        TimerJob::MarkVideoCallEnded(MarkVideoCallEndedJob { them: other, message_id }),
        now + max_duration,
        now,
    );

    StartVideoCallResult {
        message_event,
        mute_notification,
    }
}

pub struct StartVideoCallResult {
    pub message_event: EventWrapper<Message>,
    pub mute_notification: bool,
}
