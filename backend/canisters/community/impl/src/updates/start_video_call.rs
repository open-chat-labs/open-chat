use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_video_call_operator;
use crate::timer_job_types::{MarkVideoCallEndedJob, TimerJob};
use crate::{CommunityEventPusher, RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{CallParticipantInternal, MessageContentInternal, VideoCallContentInternal};
use community_canister::start_video_call_v2::*;
use constants::HOUR_IN_MS;
use oc_error_codes::OCErrorCode;
use types::{
    Caller, ChannelMessageNotification, CommunityId, FcmData, OCResult, UserId, UserNotificationPayload, VideoCallPresence,
    VideoCallType,
};

#[update(guard = "caller_is_video_call_operator", msgpack = true)]
#[trace]
fn start_video_call_v2(args: Args) -> Response {
    execute_update(|state| start_video_call_impl(args, state)).into()
}

fn start_video_call_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;

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
        CommunityEventPusher {
            now,
            rng: state.env.rng(),
            queue: &mut state.data.local_user_index_event_sync_queue,
        },
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

    let community_id: CommunityId = state.env.canister_id().into();
    let channel_avatar_id = channel.chat.avatar.as_ref().map(|d| d.id);

    // TODO i18n
    // TODO video call notifications could display decline and answer buttons
    let fcm_data = FcmData::for_channel(community_id, args.channel_id)
        .set_body("Video call incoming...".to_string())
        .set_sender_id(sender)
        .set_sender_name_with_alt(&args.initiator_display_name, &args.initiator_username)
        .set_avatar_id(channel_avatar_id);

    let notification = UserNotificationPayload::ChannelMessage(ChannelMessageNotification {
        community_id,
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
        channel_avatar_id,
    });

    state.push_notification(Some(sender), users_to_notify, notification, fcm_data);
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
