use crate::model::direct_chat::DirectChat;
use crate::updates::c2c_send_messages::{handle_message_impl, HandleMessageArgs};
use crate::{mutate_state, RuntimeState, BASIC_GROUP_CREATION_LIMIT, PREMIUM_GROUP_CREATION_LIMIT};
use ic_ledger_types::Tokens;
use types::{EventWrapper, Message, MessageContent, SuspensionDuration, TextContent, UserId};
use user_canister::c2c_send_messages::C2CReplyContext;
use user_canister::{PhoneNumberConfirmed, ReferredUserRegistered, StorageUpgraded, UserSuspended};
use utils::consts::{OPENCHAT_BOT_USERNAME, OPENCHAT_BOT_USER_ID};
use utils::format::format_to_decimal_places;
use utils::time::{DAY_IN_MS, HOUR_IN_MS};

const WELCOME_MESSAGES: &[&str] = &[
    "Welcome to OpenChat!",
    "I am the OpenChat bot. I will send you messages to let you know about events that don't belong to any other chat, such as if crypto has been deposited into your OpenChat account(s) or if you've been removed from a group. In the future you'll be able to ask me questions or send me commands.",
    "To follow all the software updates to OpenChat, join the [OpenChat Updates](/eucat-raaaa-aaaaf-adn7q-cai) group.",
    "To follow announcements by the OpenChat team, join the [Announcements](/kvvn5-aiaaa-aaaaf-aqznq-cai) group.",
    "To request new features, join the [Feature Requests](/vfaj4-zyaaa-aaaaf-aabya-cai) group.",
    "To report bugs, join the [Bug Reports](/sycha-wyaaa-aaaaf-aabka-cai) group.",
    "To provide feedback in general, join the [Product Feedback](/s7dbu-3aaaa-aaaaf-aabkq-cai) group.",
    "Please keep posts relevant to each group. If you just want to say \"hi\", post in the [OpenChat group](/vmdca-pqaaa-aaaaf-aabzq-cai)."];

pub(crate) fn send_welcome_messages() {
    mutate_state(|state| {
        if bot_chat(state).is_none() {
            for message in WELCOME_MESSAGES.iter() {
                let content = MessageContent::Text(TextContent {
                    text: message.to_string(),
                });

                send_message(content, true, state);
            }
        }
    });
}

pub(crate) fn send_group_deleted_message(
    deleted_by: UserId,
    group_name: String,
    public: bool,
    runtime_state: &mut RuntimeState,
) {
    let visibility = if public { "public" } else { "private" };
    let text = format!("The {visibility} group \"{group_name}\" was deleted by @UserId({deleted_by})");

    send_text_message(text, false, runtime_state);
}

pub(crate) fn send_removed_from_group_message(
    removed_by: UserId,
    group_name: String,
    public: bool,
    blocked: bool,
    runtime_state: &mut RuntimeState,
) {
    let visibility = if public { "public" } else { "private" };
    let action = if blocked { "blocked" } else { "removed" };
    let text = format!("You were {action} from the {visibility} group \"{group_name}\" by @UserId({removed_by})");

    send_text_message(text, false, runtime_state);
}

pub(crate) fn send_phone_number_confirmed_bot_message(event: &PhoneNumberConfirmed, runtime_state: &mut RuntimeState) {
    let storage_added = to_gb(event.storage_added);
    let new_group_limit = PREMIUM_GROUP_CREATION_LIMIT.to_string();
    let old_group_limit = BASIC_GROUP_CREATION_LIMIT.to_string();
    let text = format!("Thank you for [verifying ownership of your phone number](/{OPENCHAT_BOT_USER_ID}?faq=sms_icp). This gives you {storage_added} GB of storage allowing you to send and store images, videos, audio and other files. It also entitles you to create {new_group_limit} groups (up from {old_group_limit}).");

    send_text_message(text, false, runtime_state);
}

pub(crate) fn send_storage_ugraded_bot_message(event: &StorageUpgraded, runtime_state: &mut RuntimeState) {
    let amount_paid = to_tokens(event.cost.amount);
    let token = event.cost.token.token_symbol();
    let storage_added = to_gb(event.storage_added);
    let storage_total = to_gb(event.new_storage_limit);
    let new_group_limit = PREMIUM_GROUP_CREATION_LIMIT.to_string();
    let old_group_limit = BASIC_GROUP_CREATION_LIMIT.to_string();

    let text = if event.storage_added == event.new_storage_limit {
        format!("Thank you for [buying storage](/{OPENCHAT_BOT_USER_ID}?faq=sms_icp). You paid {amount_paid} {token} for {storage_added} GB of storage. This will allow you to send and store images, videos, audio and other files. It also entitles you to create {new_group_limit} groups (up from {old_group_limit}).")
    } else {
        format!("Thank you for buying more storage. You paid {amount_paid} {token} for {storage_added} GB of storage giving you {storage_total} GB in total.")
    };

    send_text_message(text, false, runtime_state);
}

pub(crate) fn send_referred_user_joined_message(event: &ReferredUserRegistered, runtime_state: &mut RuntimeState) {
    let user_id = event.user_id;

    let text = format!("User @UserId({user_id}) has just registered with your referral code!");

    send_text_message(text, false, runtime_state);
}

pub(crate) fn send_user_suspended_message(event: &UserSuspended, runtime_state: &mut RuntimeState) {
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

    let text = format!("Your account has been suspended.

Reason:
\"{reason}\"

You can appeal this suspension by sending a direct message to the @OpenChat Twitter account otherwise your account will be {action}.");

    send_text_message(text, false, runtime_state);
}

pub(crate) fn send_message(
    content: MessageContent,
    mute_notification: bool,
    runtime_state: &mut RuntimeState,
) -> EventWrapper<Message> {
    send_message_with_reply(content, None, mute_notification, runtime_state)
}

pub(crate) fn send_text_message(
    text: String,
    mute_notification: bool,
    runtime_state: &mut RuntimeState,
) -> EventWrapper<Message> {
    let content = MessageContent::Text(TextContent { text });
    send_message(content, mute_notification, runtime_state)
}

pub(crate) fn send_message_with_reply(
    content: MessageContent,
    replies_to: Option<C2CReplyContext>,
    mute_notification: bool,
    runtime_state: &mut RuntimeState,
) -> EventWrapper<Message> {
    let args = HandleMessageArgs {
        message_id: None,
        sender_message_index: None,
        sender_name: OPENCHAT_BOT_USERNAME.to_string(),
        content,
        replies_to,
        forwarding: false,
        correlation_id: 0,
        is_bot: true,
        now: runtime_state.env.now(),
    };

    handle_message_impl(OPENCHAT_BOT_USER_ID, args, mute_notification, runtime_state)
}

fn to_gb(bytes: u64) -> String {
    const BYTES_PER_1GB: u64 = 1024 * 1024 * 1024;
    format_to_decimal_places(bytes as f64 / BYTES_PER_1GB as f64, 2)
}

fn to_tokens(tokens: Tokens) -> String {
    const E8S_PER_TOKEN: u64 = 100_000_000;
    format_to_decimal_places(tokens.e8s() as f64 / E8S_PER_TOKEN as f64, 8)
}

fn bot_chat(runtime_state: &RuntimeState) -> Option<&DirectChat> {
    runtime_state.data.direct_chats.get(&OPENCHAT_BOT_USER_ID.into())
}
