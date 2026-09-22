use crate::RuntimeState;
use chat_events::{MessageContentInternal, NullEventPusher, PushMessageArgs, ReplyContextInternal, TextContentInternal};
use constants::{OPENCHAT_BOT_USER_ID, OPENCHAT_BOT_USERNAME};
use rand::RngExt;
use types::{
    ChannelId, CommunityId, DirectChatUserNotificationPayload, DirectMessageNotification, EventWrapper, Message, User, UserId,
    UserType,
};

use user_core::openchat_bot;

pub(crate) fn send_community_deleted_message(
    user_index: u16,
    deleted_by: UserId,
    name: String,
    public: bool,
    state: &mut RuntimeState,
) {
    send_text_message(
        user_index,
        openchat_bot::community_deleted_text(deleted_by, &name, public),
        Vec::new(),
        false,
        state,
    );
}

pub(crate) fn send_group_deleted_message(
    user_index: u16,
    deleted_by: UserId,
    group_name: String,
    public: bool,
    state: &mut RuntimeState,
) {
    send_text_message(
        user_index,
        openchat_bot::group_deleted_text(deleted_by, &group_name, public),
        Vec::new(),
        false,
        state,
    );
}

pub(crate) fn send_group_imported_into_community_message(
    user_index: u16,
    group_name: String,
    public: bool,
    community_name: String,
    community_id: CommunityId,
    channel_id: ChannelId,
    state: &mut RuntimeState,
) {
    let text = openchat_bot::group_imported_into_community_text(&group_name, public, &community_name, community_id, channel_id);
    send_text_message(user_index, text, Vec::new(), false, state);
}

pub(crate) fn send_removed_from_group_or_community_message(
    user_index: u16,
    is_group: bool,
    removed_by: UserId,
    group_or_community_name: String,
    public: bool,
    blocked: bool,
    state: &mut RuntimeState,
) {
    let text =
        openchat_bot::removed_from_group_or_community_text(is_group, removed_by, &group_or_community_name, public, blocked);
    send_text_message(user_index, text, Vec::new(), false, state);
}

pub(crate) fn send_message(
    user_index: u16,
    content: MessageContentInternal,
    mentioned: Vec<User>,
    mute_notification: bool,
    state: &mut RuntimeState,
) -> Option<EventWrapper<Message>> {
    send_message_with_reply(user_index, content, None, mentioned, mute_notification, state)
}

pub(crate) fn send_text_message(
    user_index: u16,
    text: String,
    mentioned: Vec<User>,
    mute_notification: bool,
    state: &mut RuntimeState,
) -> Option<EventWrapper<Message>> {
    let content = MessageContentInternal::Text(TextContentInternal { text });
    send_message(user_index, content, mentioned, mute_notification, state)
}

// Pushes a message from the OpenChat bot to the chat with it of the user at `user_index`, creating
// the chat if they have none, as the User canister's `openchat_bot::send_message_with_reply` does
// for its user. Returns None if there is no such user.
pub(crate) fn send_message_with_reply(
    user_index: u16,
    content: MessageContentInternal,
    replies_to: Option<ReplyContextInternal>,
    mentioned: Vec<User>,
    mute_notification: bool,
    state: &mut RuntimeState,
) -> Option<EventWrapper<Message>> {
    let my_user_id = state.user_id(user_index);
    let now = state.env.now();
    // Drawn up front, since the user is borrowed for the whole of the closure below
    let message_id = state.env.rng().random();
    let anonymized_id: u128 = state.env.rng().random();

    let chat_private_replying_to = replies_to.as_ref().and_then(|r| match r.chat_if_other {
        Some((chat, None)) => Some(chat),
        _ => None,
    });

    let (message_event, notification) = state.data.users.with_user_mut(user_index, |user| {
        let chat = user.direct_chats.get_or_create(
            my_user_id,
            OPENCHAT_BOT_USER_ID,
            UserType::OcControlledBot,
            || anonymized_id,
            now,
        );

        // TODO: Push the message to the event store (`UserEventPusher` in the User canister)
        let message_event = chat.push_message::<NullEventPusher>(
            PushMessageArgs {
                thread_root_message_index: None,
                message_id,
                sender: OPENCHAT_BOT_USER_ID,
                content,
                mentioned: Vec::new(),
                replies_to,
                forwarded: false,
                sender_is_bot: true,
                block_level_markdown: false,
                og_previews: Vec::new(),
                now,
                sender_context: None,
            },
            None,
            None,
        );

        // As with any bot, the OpenChat bot has read its own messages
        chat.mark_read_by_them_up_to(message_event.event.message_index, now);

        let notification = if mute_notification || chat.notifications_muted.value || user.suspended.value {
            None
        } else {
            let content = &message_event.event.content;
            Some(DirectChatUserNotificationPayload::DirectMessage(DirectMessageNotification {
                sender: OPENCHAT_BOT_USER_ID,
                thread_root_message_index: None,
                message_index: message_event.event.message_index,
                event_index: message_event.index,
                sender_name: OPENCHAT_BOT_USERNAME.to_string(),
                sender_display_name: None,
                message_type: content.content_type().to_string(),
                message_text: content.notification_text(&mentioned, &[]),
                image_url: content.notification_image_url(),
                file_name: content.notification_file_name(),
                sender_avatar_id: None,
                crypto_transfer: content.notification_crypto_transfer_details(&[]),
            }))
        };

        if let Some(chat) = chat_private_replying_to {
            user.direct_chats
                .mark_private_reply(OPENCHAT_BOT_USER_ID, chat, message_event.event.message_index);
        }

        (message_event, notification)
    })?;

    if let Some(expiry) = message_event.expires_at {
        state.handle_event_expiry(user_index, expiry);
    }

    if let Some(notification) = notification {
        state.push_notification(Some(OPENCHAT_BOT_USER_ID), user_index, notification, now);
    }

    Some(message_event)
}
