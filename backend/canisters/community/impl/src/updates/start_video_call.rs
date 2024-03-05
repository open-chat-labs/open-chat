use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_video_call_operator;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::MessageContentInternal;
use community_canister::send_message::SuccessResult;
use community_canister::start_video_call::{Response::*, *};
use event_sink_client::EventBuilder;
use group_chat_core::SendMessageResult;
use ic_cdk_macros::update;
use types::{CallParticipant, ChannelMessageNotification, Notification, UserId, VideoCallContent};

#[update(guard = "caller_is_video_call_operator")]
#[trace]
fn start_video_call(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| start_video_call_impl(args, state))
}

fn start_video_call_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return NotAuthorized;
    }

    let Some(channel) = state.data.channels.get_mut(&args.channel_id) else {
        return NotAuthorized;
    };

    let sender = args.initiator;
    let now = state.env.now();

    let result = match channel.chat.send_message(
        sender,
        None,
        args.message_id,
        MessageContentInternal::VideoCall(VideoCallContent {
            ended: None,
            participants: vec![CallParticipant {
                user_id: sender,
                joined: now,
            }],
        }),
        None,
        Vec::new(),
        false,
        None,
        false,
        state.data.proposals_bot_user_id,
        now,
    ) {
        SendMessageResult::Success(r) => r,
        _ => return NotAuthorized,
    };

    let event_index = result.message_event.index;
    let message_index = result.message_event.event.message_index;
    let expires_at = result.message_event.expires_at;

    // Exclude suspended members from notification
    let users_to_notify: Vec<UserId> = result
        .users_to_notify
        .into_iter()
        .filter(|u| state.data.members.get_by_user_id(u).map_or(false, |m| !m.suspended.value))
        .collect();

    let content = &result.message_event.event.content;
    let this_canister_id = state.env.canister_id();
    let notification = Notification::ChannelMessage(ChannelMessageNotification {
        community_id: this_canister_id.into(),
        channel_id: args.channel_id,
        thread_root_message_index: None,
        message_index,
        event_index,
        sender,
        sender_name: args.initiator_username,
        sender_display_name: args.initiator_display_name,
        message_type: content.message_type(),
        message_text: None,
        image_url: None,
        crypto_transfer: None,
        community_name: state.data.name.clone(),
        channel_name: channel.chat.name.value.clone(),
        community_avatar_id: state.data.avatar.as_ref().map(|d| d.id),
        channel_avatar_id: channel.chat.avatar.as_ref().map(|d| d.id),
    });

    state.push_notification(users_to_notify, notification);
    handle_activity_notification(state);

    state.data.event_sink_client.push(
        EventBuilder::new("message_sent", now)
            .with_user(sender.to_string())
            .with_source(this_canister_id.to_string())
            .with_json_payload(&result.event_payload)
            .build(),
    );

    if let Some(expiry) = expires_at {
        state.data.handle_event_expiry(expiry, now);
    }

    Success(SuccessResult {
        event_index,
        message_index,
        timestamp: now,
        expires_at,
    })
}
