use crate::{MultiUserEventPusher, RuntimeState};
use candid::Principal;
use chat_events::{MessageContentInternal, TextContentInternal};
use constants::{OPENCHAT_BOT_USER_ID, OPENCHAT_BOT_USERNAME};
use rand::RngExt;
use types::{EventWrapper, Message, User, UserId, UserType};
use user_canister::C2CReplyContext;
use user_core::openchat_bot;
use user_core::updates::c2c_user_canister::ReceiveMessageArgs;

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

// Tells a user migrated here from a User canister of their new wallet address. Their funds were held
// by their canister, whereas now they are held in the account of the principal they sign in with,
// which is also what they must add as a hotkey to their neurons to vote with them from OpenChat.
pub(crate) fn send_account_migrated_message(user_index: u16, wallet: Principal, state: &mut RuntimeState) {
    send_text_message(user_index, account_migrated_text(wallet), Vec::new(), false, state);
}

fn account_migrated_text(wallet: Principal) -> String {
    format!(
        "We've moved your account to our new system, which gives you a new wallet address:

{wallet}

Any tokens in your old wallet will be transferred to your new one automatically.

To vote on proposals from within OpenChat, you'll need to add this address as a hotkey to each neuron you would like to vote with."
    )
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
    replies_to: Option<C2CReplyContext>,
    mentioned: Vec<User>,
    mute_notification: bool,
    state: &mut RuntimeState,
) -> Option<EventWrapper<Message>> {
    let my_user_id = state.user_id(user_index);
    let now = state.env.now();
    let anonymized_id: u128 = state.env.rng().random();
    let args = ReceiveMessageArgs {
        sender: OPENCHAT_BOT_USER_ID,
        sender_user_type: UserType::OcControlledBot,
        sender_name: OPENCHAT_BOT_USERNAME.to_string(),
        sender_display_name: None,
        sender_avatar_id: None,
        thread_root_message_id: None,
        message_id: state.env.rng().random(),
        sender_message_index: None,
        content,
        replies_to,
        forwarding: false,
        block_level_markdown: false,
        og_previews: Vec::new(),
        mentioned,
        mute_notification,
    };

    // As in the User canister, the OpenChat bot's messages are pushed to the event store
    let event_pusher = MultiUserEventPusher {
        user_id: my_user_id,
        now,
        rng: state.env.rng(),
        queue: &mut state.data.local_user_index_event_sync_queue,
    };

    // Its id is freshly drawn, so it can't already be in the chat, and it isn't in a thread, so this
    // is None only if there is no such user
    let received = state
        .data
        .users
        .with_user_mut(user_index, |user| {
            user_core::updates::c2c_user_canister::receive_message(
                user,
                my_user_id,
                args,
                Some(event_pusher),
                anonymized_id,
                now,
            )
        })
        .flatten()?;

    if let Some(expiry) = received.message_event.expires_at {
        state.handle_event_expiry(user_index, expiry);
    }

    if let Some(notification) = received.notification {
        state.push_notification(Some(OPENCHAT_BOT_USER_ID), user_index, notification, now);
    }

    Some(received.message_event)
}
