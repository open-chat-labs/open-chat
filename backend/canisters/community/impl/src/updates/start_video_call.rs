use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_video_call_operator;
use crate::timer_job_types::{MarkVideoCallEndedJob, TimerJob};
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::{CallParticipantInternal, MessageContentInternal, VideoCallContentInternal};
use community_canister::start_video_call_v2::{Response::*, *};
use constants::HOUR_IN_MS;
use ic_cdk::update;
use oc_error_codes::OCErrorCode;
use types::{Caller, ChannelMessageNotification, Notification, OCResult, UserId, VideoCallPresence, VideoCallType};

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
    if state.data.is_frozen() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let Some(channel) = state.data.channels.get_mut(&args.channel_id) else {
        return Err(OCErrorCode::ChatNotFound.into());
    };

    if matches!(
        (args.call_type, channel.chat.is_public.value, state.data.is_public.value),
        (VideoCallType::Default, true, true)
    ) {
        return Err(OCErrorCode::InitiatorNotAuthorized.with_message("Video call type not allowed"));
    }

    let sender = args.initiator;
    let now = state.env.now();

    let result = channel.chat.send_message(
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
        &[],
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

    // Exclude suspended members from notification
    let users_to_notify: Vec<UserId> = result
        .users_to_notify
        .into_iter()
        .filter(|u| state.data.members.get_by_user_id(u).is_some_and(|m| !m.suspended().value))
        .collect();

    let notification = Notification::ChannelMessage(ChannelMessageNotification {
        community_id: state.env.canister_id().into(),
        channel_id: args.channel_id,
        thread_root_message_index: None,
        message_index,
        event_index,
        sender,
        sender_name: args.initiator_username,
        sender_display_name: args.initiator_display_name,
        message_type: result.message_event.event.content.message_type(),
        message_text: None,
        image_url: None,
        crypto_transfer: None,
        community_name: state.data.name.value.clone(),
        channel_name: channel.chat.name.value.clone(),
        community_avatar_id: state.data.avatar.as_ref().map(|d| d.id),
        channel_avatar_id: channel.chat.avatar.as_ref().map(|d| d.id),
    });

    state.push_notification(Some(sender), users_to_notify, notification);
    handle_activity_notification(state);

    if let Some(expiry) = expires_at {
        state.data.handle_event_expiry(expiry, now);
    }

    let max_duration = args.max_duration.unwrap_or(HOUR_IN_MS);
    state.data.timer_jobs.enqueue_job(
        TimerJob::MarkVideoCallEnded(MarkVideoCallEndedJob(community_canister::end_video_call_v2::Args {
            channel_id: args.channel_id,
            message_id: args.message_id,
        })),
        now + max_duration,
        now,
    );

    Ok(())
}
