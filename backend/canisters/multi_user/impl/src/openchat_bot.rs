use crate::RuntimeState;
use chat_events::{MessageContentInternal, NullEventPusher, PushMessageArgs, ReplyContextInternal, TextContentInternal};
use constants::{DAY_IN_MS, HOUR_IN_MS, OPENCHAT_BOT_USER_ID, OPENCHAT_BOT_USERNAME};
use rand::RngExt;
use types::nns::Tokens;
use types::{
    ChannelId, CommunityId, DirectChatUserNotificationPayload, DirectMessageNotification, EventWrapper, Message,
    SuspensionDuration, User, UserId, UserType,
};
use user_canister::{PhoneNumberConfirmed, StorageUpgraded, UserSuspended};
use user_state::Membership;
use utils::format::format_to_decimal_places;

// The texts below match the User canister's `openchat_bot` messages of the same names

pub(crate) fn send_community_deleted_message(
    user_index: u16,
    deleted_by: UserId,
    name: String,
    public: bool,
    state: &mut RuntimeState,
) {
    let visibility = if public { "public" } else { "private" };
    let text = format!("The {visibility} community \"{name}\" was deleted by @UserId({deleted_by})");

    send_text_message(user_index, text, Vec::new(), false, state);
}

pub(crate) fn send_group_deleted_message(
    user_index: u16,
    deleted_by: UserId,
    group_name: String,
    public: bool,
    state: &mut RuntimeState,
) {
    let visibility = if public { "public" } else { "private" };
    let text = format!("The {visibility} group \"{group_name}\" was deleted by @UserId({deleted_by})");

    send_text_message(user_index, text, Vec::new(), false, state);
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
    let visibility = if public { "public" } else { "private" };
    let text = format!(
        "The {visibility} group \"{group_name}\" was deleted because it was imported into the [\"{community_name}\"](/community/{community_id}/channel/{channel_id}) community"
    );

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
    let visibility = if public { "public" } else { "private" };
    let action = if blocked { "blocked" } else { "removed" };
    let group_or_community = if is_group { "group" } else { "community" };
    let text = format!(
        "You were {action} from the {visibility} {group_or_community} \"{group_or_community_name}\" by @UserId({removed_by})"
    );

    send_text_message(user_index, text, Vec::new(), false, state);
}

pub(crate) fn send_user_suspended_message(user_index: u16, event: &UserSuspended, state: &mut RuntimeState) {
    let action = match event.duration {
        SuspensionDuration::Duration(ms) => {
            if ms < 2 * DAY_IN_MS {
                let hours = ms / HOUR_IN_MS;
                format!("unsuspended in {hours} hours")
            } else {
                let days = ms / DAY_IN_MS;
                format!("unsuspended in {days} days")
            }
        }
        SuspensionDuration::Indefinitely => "deleted in 90 days".to_string(),
    };

    let reason = &event.reason;

    let text = format!(
        "Your account has been suspended.

Reason:
\"{reason}\"

You can appeal this suspension by emailing safety@openchatlabs.org otherwise your account will be {action}."
    );

    send_text_message(user_index, text, Vec::new(), false, state);
}

pub(crate) fn send_phone_number_confirmed_bot_message(user_index: u16, event: &PhoneNumberConfirmed, state: &mut RuntimeState) {
    let storage_added = to_gb(event.storage_added);
    let new_group_limit = Membership::Diamond.group_creation_limit().to_string();
    let old_group_limit = Membership::Basic.group_creation_limit().to_string();
    let text = format!(
        "Thank you for [verifying ownership of your phone number](/{OPENCHAT_BOT_USER_ID}?faq=sms_icp). This gives you {storage_added} GB of storage allowing you to send and store images, videos, audio and other files. It also entitles you to create {new_group_limit} groups (up from {old_group_limit})."
    );

    send_text_message(user_index, text, Vec::new(), false, state);
}

pub(crate) fn send_storage_ugraded_bot_message(user_index: u16, event: &StorageUpgraded, state: &mut RuntimeState) {
    let amount_paid = to_tokens(event.cost.amount);
    let token = &event.cost.token_symbol;
    let storage_added = to_gb(event.storage_added);
    let storage_total = to_gb(event.new_storage_limit);
    let new_group_limit = Membership::Diamond.group_creation_limit().to_string();
    let old_group_limit = Membership::Basic.group_creation_limit().to_string();

    let text = if event.storage_added == event.new_storage_limit {
        format!(
            "Thank you for [buying storage](/{OPENCHAT_BOT_USER_ID}?faq=sms_icp). You paid {amount_paid} {token} for {storage_added} GB of storage. This will allow you to send and store images, videos, audio and other files. It also entitles you to create {new_group_limit} groups (up from {old_group_limit})."
        )
    } else {
        format!(
            "Thank you for buying more storage. You paid {amount_paid} {token} for {storage_added} GB of storage giving you {storage_total} GB in total."
        )
    };

    send_text_message(user_index, text, Vec::new(), false, state);
}

pub(crate) fn send_referred_user_joined_message(user_index: u16, user_id: UserId, username: String, state: &mut RuntimeState) {
    let text = format!("User @UserId({user_id}) has just registered with your referral code!");

    send_text_message(user_index, text, vec![User { user_id, username }], false, state);
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

fn to_gb(bytes: u64) -> String {
    const BYTES_PER_1GB: u64 = 1024 * 1024 * 1024;
    format_to_decimal_places(bytes as f64 / BYTES_PER_1GB as f64, 2)
}

fn to_tokens(tokens: Tokens) -> String {
    const E8S_PER_TOKEN: u64 = 100_000_000;
    format_to_decimal_places(tokens.e8s() as f64 / E8S_PER_TOKEN as f64, 8)
}
