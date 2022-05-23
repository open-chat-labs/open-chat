use crate::updates::c2c_send_message::c2c_send_message_impl;
use crate::{mutate_state, RuntimeState};
use candid::Principal;
use types::{MessageContent, TextContent, UserId};
use user_canister::c2c_send_message;

// zzyk3-openc-hatbo-tq7my-cai
pub const OPENCHAT_BOT_USER_ID: UserId = UserId::new(Principal::from_slice(&[228, 104, 142, 9, 133, 211, 135, 217, 129, 1]));
pub const OPENCHAT_BOT_USERNAME: &str = "OpenChatBot";

const WELCOME_MESSAGE: &str = "Hello World!";
const EXISTING_USER_WELCOME_MESSAGE: &str = "Hello World!";

pub(crate) fn send_welcome_message() {
    let content = MessageContent::Text(TextContent {
        text: WELCOME_MESSAGE.to_string(),
    });

    mutate_state(|state| {
        if !bot_chat_exists(state) {
            send_message(content, true, state);
        }
    });
}

pub(crate) fn send_existing_user_welcome_message() {
    let content = MessageContent::Text(TextContent {
        text: EXISTING_USER_WELCOME_MESSAGE.to_string(),
    });

    mutate_state(|state| {
        if !bot_chat_exists(state) {
            send_message(content, true, state)
        }
    });
}

pub(crate) fn send_group_deleted_message(
    deleted_by: UserId,
    group_name: String,
    public: bool,
    runtime_state: &mut RuntimeState,
) {
    let visibility = if public { "Public" } else { "Private" };

    let content = MessageContent::Text(TextContent {
        text: format!(
            "The group _{} ({})_ was deleted by @UserId({})",
            group_name, visibility, deleted_by
        ),
    });

    send_message(content, false, runtime_state);
}

pub(crate) fn send_removed_from_group_message(
    removed_by: UserId,
    group_name: String,
    public: bool,
    runtime_state: &mut RuntimeState,
) {
    let visibility = if public { "Public" } else { "Private" };

    let content = MessageContent::Text(TextContent {
        text: format!(
            "You were removed from the group _{} ({})_ by @UserId({})",
            group_name, visibility, removed_by
        ),
    });

    send_message(content, false, runtime_state);
}

pub(crate) fn send_blocked_from_group_message(
    blocked_by: UserId,
    group_name: String,
    public: bool,
    runtime_state: &mut RuntimeState,
) {
    let visibility = if public { "Public" } else { "Private" };

    let content = MessageContent::Text(TextContent {
        text: format!(
            "You were blocked from the group _{} ({})_ by @UserId({})",
            group_name, visibility, blocked_by
        ),
    });

    send_message(content, false, runtime_state);
}

fn send_message(content: MessageContent, mute_notification: bool, runtime_state: &mut RuntimeState) {
    let message_index = runtime_state
        .data
        .direct_chats
        .get(&OPENCHAT_BOT_USER_ID.into())
        .and_then(|c| c.events.latest_message_index())
        .map(|i| i.incr())
        .unwrap_or_default();

    let mut message_id_bytes = [0; 16];
    for index in (0..4).map(|i| 4 * i) {
        message_id_bytes[index..index + 4].copy_from_slice(&runtime_state.env.random_u32().to_ne_bytes());
    }

    let message_id = u128::from_ne_bytes(message_id_bytes).into();

    let args = c2c_send_message::Args {
        message_id,
        sender_message_index: message_index,
        sender_name: OPENCHAT_BOT_USERNAME.to_string(),
        content,
        replies_to_v2: None,
    };

    c2c_send_message_impl(OPENCHAT_BOT_USER_ID, args, mute_notification, runtime_state);
}

fn bot_chat_exists(runtime_state: &RuntimeState) -> bool {
    runtime_state.data.direct_chats.get(&OPENCHAT_BOT_USER_ID.into()).is_some()
}
