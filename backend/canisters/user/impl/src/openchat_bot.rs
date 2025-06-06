use crate::updates::c2c_send_messages::{HandleMessageArgs, handle_message_impl};
use crate::{Membership, RuntimeState};
use chat_events::{MessageContentInternal, TextContentInternal};
use constants::{DAY_IN_MS, HOUR_IN_MS, OPENCHAT_BOT_USER_ID, OPENCHAT_BOT_USERNAME};
use types::nns::Tokens;
use types::{ChannelId, CommunityId, EventWrapper, Message, SuspensionDuration, User, UserId, UserType};
use user_canister::{C2CReplyContext, PhoneNumberConfirmed, StorageUpgraded, UserSuspended};
use utils::format::format_to_decimal_places;

pub(crate) fn send_community_deleted_message(deleted_by: UserId, name: String, public: bool, state: &mut RuntimeState) {
    let visibility = if public { "public" } else { "private" };
    let text = format!("The {visibility} community \"{name}\" was deleted by @UserId({deleted_by})");

    send_text_message(text, Vec::new(), false, state);
}

pub(crate) fn send_group_deleted_message(deleted_by: UserId, group_name: String, public: bool, state: &mut RuntimeState) {
    let visibility = if public { "public" } else { "private" };
    let text = format!("The {visibility} group \"{group_name}\" was deleted by @UserId({deleted_by})");

    send_text_message(text, Vec::new(), false, state);
}

pub(crate) fn send_group_imported_into_community_message(
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
    let visibility = if public { "public" } else { "private" };
    let action = if blocked { "blocked" } else { "removed" };
    let group_or_community = if is_group { "group" } else { "community" };
    let text = format!(
        "You were {action} from the {visibility} {group_or_community} \"{group_or_community_name}\" by @UserId({removed_by})"
    );

    send_text_message(text, Vec::new(), false, state);
}

pub(crate) fn send_phone_number_confirmed_bot_message(event: &PhoneNumberConfirmed, state: &mut RuntimeState) {
    let storage_added = to_gb(event.storage_added);
    let new_group_limit = Membership::Diamond.group_creation_limit().to_string();
    let old_group_limit = Membership::Basic.group_creation_limit().to_string();
    let text = format!(
        "Thank you for [verifying ownership of your phone number](/{OPENCHAT_BOT_USER_ID}?faq=sms_icp). This gives you {storage_added} GB of storage allowing you to send and store images, videos, audio and other files. It also entitles you to create {new_group_limit} groups (up from {old_group_limit})."
    );

    send_text_message(text, Vec::new(), false, state);
}

pub(crate) fn send_storage_ugraded_bot_message(event: &StorageUpgraded, state: &mut RuntimeState) {
    let amount_paid = to_tokens(event.cost.amount);
    let token = event.cost.token.token_symbol();
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

    send_text_message(text, Vec::new(), false, state);
}

pub(crate) fn send_referred_user_joined_message(user_id: UserId, username: String, state: &mut RuntimeState) {
    let text = format!("User @UserId({user_id}) has just registered with your referral code!");

    send_text_message(text, vec![User { user_id, username }], false, state);
}

pub(crate) fn send_user_suspended_message(event: &UserSuspended, state: &mut RuntimeState) {
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
        thread_root_message_id: None,
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
        now: state.env.now(),
    };

    handle_message_impl(args, None, false, state)
}

fn to_gb(bytes: u64) -> String {
    const BYTES_PER_1GB: u64 = 1024 * 1024 * 1024;
    format_to_decimal_places(bytes as f64 / BYTES_PER_1GB as f64, 2)
}

fn to_tokens(tokens: Tokens) -> String {
    const E8S_PER_TOKEN: u64 = 100_000_000;
    format_to_decimal_places(tokens.e8s() as f64 / E8S_PER_TOKEN as f64, 8)
}
