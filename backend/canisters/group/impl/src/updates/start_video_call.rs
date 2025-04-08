use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_video_call_operator;
use crate::timer_job_types::{MarkVideoCallEndedJob, RemoveExpiredEventsJob};
use crate::{mutate_state, run_regular_jobs, RuntimeState, TimerJob};
use canister_tracing_macros::trace;
use chat_events::{CallParticipantInternal, MessageContentInternal, VideoCallContentInternal};
use constants::HOUR_IN_MS;
use group_canister::start_video_call_v2::{Response::*, *};
use ic_cdk::update;
use oc_error_codes::OCErrorCode;
use types::{Caller, GroupMessageNotification, Notification, OCResult, VideoCallPresence, VideoCallType};

#[update(guard = "caller_is_video_call_operator")]
#[trace]
fn start_video_call_v2(args: Args) -> Response {
    run_regular_jobs();

    if let Err(error) = mutate_state(|state| start_video_call_impl(args, state)) {
        Error(error)
    } else {
        Success
    }
}

fn start_video_call_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    if matches!(
        (args.call_type, state.data.chat.is_public.value),
        (VideoCallType::Default, true)
    ) {
        return Err(OCErrorCode::InitiatorNotAuthorized.with_message("Video call type not allowed"));
    }

    let sender = args.initiator;
    let now = state.env.now();

    let result = state.data.chat.send_message(
        &Caller::User(sender),
        None,
        args.message_id,
        MessageContentInternal::VideoCall(VideoCallContentInternal {
            call_type: args.call_type,
            ended: None,
            participants: [(
                sender,
                CallParticipantInternal {
                    joined: now,
                    last_updated: None,
                    presence: VideoCallPresence::Owner,
                },
            )]
            .into_iter()
            .collect(),
        }),
        None,
        &Vec::new(),
        false,
        None,
        false,
        false,
        &mut state.data.event_store_client,
        true,
        now,
    )?;

    let event_index = result.message_event.index;
    let message_index = result.message_event.event.message_index;
    let expires_at = result.message_event.expires_at;

    if let Some(expiry) = expires_at {
        if state.data.next_event_expiry.is_none_or(|ex| expiry < ex) {
            let timer_jobs = &mut state.data.timer_jobs;
            timer_jobs.cancel_jobs(|j| matches!(j, TimerJob::RemoveExpiredEvents(_)));
            timer_jobs.enqueue_job(TimerJob::RemoveExpiredEvents(RemoveExpiredEventsJob), expiry, now);
        }
    }

    let notification = Notification::GroupMessage(GroupMessageNotification {
        chat_id: state.env.canister_id().into(),
        thread_root_message_index: None,
        message_index,
        event_index,
        group_name: state.data.chat.name.value.clone(),
        sender,
        sender_name: args.initiator_username,
        sender_display_name: args.initiator_display_name,
        message_type: result.message_event.event.content.message_type(),
        message_text: None,
        image_url: None,
        group_avatar_id: state.data.chat.avatar.as_ref().map(|d| d.id),
        crypto_transfer: None,
    });
    state.push_notification(Some(sender), result.users_to_notify, notification);
    handle_activity_notification(state);

    let max_duration = args.max_duration.unwrap_or(HOUR_IN_MS);
    state.data.timer_jobs.enqueue_job(
        TimerJob::MarkVideoCallEnded(MarkVideoCallEndedJob(group_canister::end_video_call_v2::Args {
            message_id: args.message_id,
        })),
        now + max_duration,
        now,
    );
    Ok(())
}
