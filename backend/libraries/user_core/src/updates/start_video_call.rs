use crate::User;
use chat_events::{CallParticipantInternal, EventPusher, MessageContentInternal, PushMessageArgs, VideoCallContentInternal};
use oc_error_codes::OCErrorCode;
use types::{
    CallFacts, CallKind, DirectChatUserNotificationPayload, DirectMessageNotification, EventWrapper, Message, MessageId,
    MessageIndex, OCResult, TimestampMillis, UserId, UserType, VideoCallPresence, VideoCallType,
};
use user_canister::start_video_call_v2::Args;

// Checks the user may be called by the initiator, returning the kind of call
pub fn prepare(user: &User, my_user_id: UserId, args: &Args) -> OCResult<CallKind> {
    if user.suspended.value
        || user.blocked_users.contains(&args.initiator)
        || args.initiator == my_user_id
        || matches!(args.call_type, VideoCallType::Broadcast)
    {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }
    // Broadcasts are refused above, so this only fails for a pair that names one
    CallKind::from_wire(args.call_type, args.audio_only.unwrap_or_default())
        .ok_or_else(|| OCErrorCode::InitiatorNotAuthorized.into())
}

// The message recording the call in the user's copy of the chat
pub struct Started {
    pub message_event: EventWrapper<Message>,
    // No notification for the initiator's own copy, or if the user has muted the chat
    pub mute_notification: bool,
}

// Records the call started by `sender` in the user's chat with `other`, creating the chat if they
// have none. On the callee's side `their_message_index` is None; on the initiator's it is the index
// the message has in the callee's copy. The caller handles the message's expiry and marks the call
// ended when its time is up.
#[expect(clippy::too_many_arguments)]
pub fn handle_start_video_call<P: EventPusher>(
    user: &mut User,
    my_user_id: UserId,
    message_id: MessageId,
    their_message_index: Option<MessageIndex>,
    sender: UserId,
    other: UserId,
    call_kind: CallKind,
    anonymized_chat_id: impl FnOnce() -> u128,
    event_pusher: Option<P>,
    now: TimestampMillis,
) -> Started {
    let push_message_args = PushMessageArgs {
        thread_root_message_index: None,
        message_id,
        sender,
        content: MessageContentInternal::VideoCall(VideoCallContentInternal {
            call_type: call_kind,
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
        mentioned: Vec::new(),
        replies_to: None,
        forwarded: false,
        sender_is_bot: true,
        block_level_markdown: false,
        og_previews: Vec::new(),
        now,
        sender_context: None,
    };

    let chat = user
        .direct_chats
        .get_or_create(my_user_id, other, UserType::User, anonymized_chat_id, now);
    let mute_notification = their_message_index.is_some() || chat.notifications_muted.value;
    let message_event = chat.push_message(push_message_args, their_message_index, event_pusher);

    Started {
        message_event,
        mute_notification,
    }
}

// The callee's notification of the call, which rings their devices
pub fn notification(
    args: &Args,
    call_kind: CallKind,
    message_event: &EventWrapper<Message>,
) -> DirectChatUserNotificationPayload {
    DirectChatUserNotificationPayload::DirectMessage(DirectMessageNotification {
        sender: args.initiator,
        thread_root_message_index: None,
        message_index: message_event.event.message_index,
        event_index: message_event.index,
        sender_name: args.initiator_username.clone(),
        sender_display_name: args.initiator_display_name.clone(),
        message_type: message_event.event.content.content_type().to_string(),
        message_text: None,
        image_url: None,
        file_name: None,
        sender_avatar_id: args.initiator_avatar_id,
        crypto_transfer: None,
        call: Some(CallFacts {
            message_id: args.message_id,
            call_type: call_kind.call_type(),
            audio_only: call_kind.audio_only(),
            started: message_event.timestamp,
            is_public: false,
            member_count: 2,
        }),
    })
}
