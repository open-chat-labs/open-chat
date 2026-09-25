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
    CallFacts, CallKind, Caller, ChannelMessageNotification, ChannelUserNotificationPayload, CommunityId, OCResult, UserId,
    VideoCallPresence, VideoCallType,
};

#[update(guard = "caller_is_video_call_operator", candid = true, msgpack = true)]
#[trace]
fn start_video_call_v2(args: Args) -> Response {
    execute_update(|state| start_video_call_impl(args, state)).into()
}

fn start_video_call_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    // Looked up before the channel is borrowed
    let sender = state.member_user(args.initiator);
    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;

    if matches!(
        (args.call_type, channel.chat.is_public.value, state.data.is_public.value),
        (VideoCallType::Default, true, true)
    ) {
        return Err(OCErrorCode::InitiatorNotAuthorized.with_message("Video call type not allowed"));
    }

    // There is no such thing as an audio only broadcast
    let Some(call_kind) = CallKind::from_wire(args.call_type, args.audio_only.unwrap_or_default()) else {
        return Err(OCErrorCode::InitiatorNotAuthorized.with_message("Video call type not allowed"));
    };

    let now = state.env.now();

    let result = channel.chat.send_message(
        &Caller::User(sender),
        None,
        args.message_id,
        MessageContentInternal::VideoCall(VideoCallContentInternal {
            call_type: call_kind,
            ended: None,
            participants: [(
                sender.user_id,
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
        Vec::new(),
        &state.data.migrated_user_ids,
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

    let notification = ChannelUserNotificationPayload::ChannelMessage(ChannelMessageNotification {
        community_id,
        channel_id: args.channel_id,
        thread_root_message_index: None,
        message_index,
        event_index,
        sender: sender.user_id,
        sender_name: args.initiator_username,
        sender_display_name: args.initiator_display_name,
        message_type: result.message_event.event.content.content_type().to_string(),
        message_text: None,
        image_url: None,
        file_name: None,
        crypto_transfer: None,
        community_name: state.data.name.value.clone(),
        channel_name: channel.chat.name.value.clone(),
        community_avatar_id: state.data.avatar.as_ref().map(|d| d.id),
        channel_avatar_id,
        // a channel never rings; the facts are still sent so the policy stays in one place
        call: Some(CallFacts {
            message_id: args.message_id,
            call_type: call_kind.call_type(),
            audio_only: call_kind.audio_only(),
            started: result.message_event.timestamp,
            is_public: channel.chat.is_public.value,
            member_count: channel.chat.members.len(),
        }),
    });

    state.push_notification(Some(sender.user_id), users_to_notify, notification);
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
