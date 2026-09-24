use crate::RuntimeState;
use crate::updates::c2c_send_messages::{HandleMessageArgs, handle_message_impl};
use chat_events::{MessageContentInternal, TextContentInternal};
use constants::{OPENCHAT_BOT_USER_ID, OPENCHAT_BOT_USERNAME};
use types::{EventWrapper, Message, User, UserId, UserType};
use user_canister::C2CReplyContext;
use user_core::openchat_bot;

pub(crate) fn send_community_deleted_message(deleted_by: UserId, name: String, public: bool, state: &mut RuntimeState) {
    send_text_message(
        openchat_bot::community_deleted_text(deleted_by, &name, public),
        Vec::new(),
        false,
        state,
    );
}

pub(crate) fn send_removed_from_group_or_community_message(
    is_group: bool,
    removed_by: UserId,
    group_or_community_name: String,
    public: bool,
    blocked: bool,
    state: &mut RuntimeState,
) {
    let text =
        openchat_bot::removed_from_group_or_community_text(is_group, removed_by, &group_or_community_name, public, blocked);
    send_text_message(text, Vec::new(), false, state);
}

pub(crate) fn send_message(
    content: MessageContentInternal,
    mentioned: Vec<User>,
    mute_notification: bool,
    state: &mut RuntimeState,
) -> EventWrapper<Message> {
    send_message_with_reply(content, None, mentioned, mute_notification, state)
}

pub(crate) fn send_text_message(
    text: String,
    mentioned: Vec<User>,
    mute_notification: bool,
    state: &mut RuntimeState,
) -> EventWrapper<Message> {
    let content = MessageContentInternal::Text(TextContentInternal { text });
    send_message(content, mentioned, mute_notification, state)
}

pub(crate) fn send_message_with_reply(
    content: MessageContentInternal,
    replies_to: Option<C2CReplyContext>,
    mentioned: Vec<User>,
    mute_notification: bool,
    state: &mut RuntimeState,
) -> EventWrapper<Message> {
    let args = HandleMessageArgs {
        sender: OPENCHAT_BOT_USER_ID,
        thread_root_message_index: None,
        message_id: None,
        sender_message_index: None,
        sender_name: OPENCHAT_BOT_USERNAME.to_string(),
        sender_display_name: None,
        content,
        replies_to,
        forwarding: false,
        sender_user_type: UserType::OcControlledBot,
        sender_avatar_id: None,
        push_message_sent_event: true,
        mute_notification,
        mentioned,
        block_level_markdown: false,
        og_previews: Vec::new(),
        now: state.env.now(),
    };

    handle_message_impl(args, state)
}
