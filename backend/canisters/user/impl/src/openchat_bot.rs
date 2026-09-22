use crate::RuntimeState;
use crate::updates::c2c_send_messages::{HandleMessageArgs, handle_message_impl};
use chat_events::{MessageContentInternal, TextContentInternal};
use constants::{OPENCHAT_BOT_USER_ID, OPENCHAT_BOT_USERNAME};
use types::{ChannelId, CommunityId, EventWrapper, Message, User, UserId, UserType};
use user_canister::{C2CReplyContext, PhoneNumberConfirmed, StorageUpgraded, UserSuspended};
use user_core::openchat_bot;

pub(crate) fn send_community_deleted_message(deleted_by: UserId, name: String, public: bool, state: &mut RuntimeState) {
    send_text_message(
        openchat_bot::community_deleted_text(deleted_by, &name, public),
        Vec::new(),
        false,
        state,
    );
}

pub(crate) fn send_group_deleted_message(deleted_by: UserId, group_name: String, public: bool, state: &mut RuntimeState) {
    send_text_message(
        openchat_bot::group_deleted_text(deleted_by, &group_name, public),
        Vec::new(),
        false,
        state,
    );
}

pub(crate) fn send_group_imported_into_community_message(
    group_name: String,
    public: bool,
    community_name: String,
    community_id: CommunityId,
    channel_id: ChannelId,
    state: &mut RuntimeState,
) {
    let text = openchat_bot::group_imported_into_community_text(&group_name, public, &community_name, community_id, channel_id);
    send_text_message(text, Vec::new(), false, state);
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

pub(crate) fn send_phone_number_confirmed_bot_message(event: &PhoneNumberConfirmed, state: &mut RuntimeState) {
    send_text_message(openchat_bot::phone_number_confirmed_text(event), Vec::new(), false, state);
}

pub(crate) fn send_storage_ugraded_bot_message(event: &StorageUpgraded, state: &mut RuntimeState) {
    send_text_message(openchat_bot::storage_upgraded_text(event), Vec::new(), false, state);
}

pub(crate) fn send_referred_user_joined_message(user_id: UserId, username: String, state: &mut RuntimeState) {
    let text = openchat_bot::referred_user_joined_text(user_id);
    send_text_message(text, vec![User { user_id, username }], false, state);
}

pub(crate) fn send_user_suspended_message(event: &UserSuspended, state: &mut RuntimeState) {
    send_text_message(openchat_bot::user_suspended_text(event), Vec::new(), false, state);
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

    handle_message_impl(args, None, false, state)
}
