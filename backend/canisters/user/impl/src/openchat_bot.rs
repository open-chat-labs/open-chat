use crate::updates::c2c_send_message::c2c_send_message_impl;
use crate::{mutate_state, RuntimeState, BASIC_GROUP_CREATION_LIMIT, PREMIUM_GROUP_CREATION_LIMIT};
use candid::Principal;
use ic_ledger_types::Tokens;
use std::fmt::Write;
use types::{
    CanisterId, MessageContent, MessageId, NeuronId, PhoneNumberConfirmed, ProposalId, ReferredUserRegistered, StorageUpgraded,
    TextContent, UserId,
};
use user_canister::c2c_send_message;
use utils::format::format_to_decimal_places;

// zzyk3-openc-hatbo-tq7my-cai
pub const OPENCHAT_BOT_USER_ID: UserId = UserId::new(Principal::from_slice(&[228, 104, 142, 9, 133, 211, 135, 217, 129, 1]));
pub const OPENCHAT_BOT_USERNAME: &str = "OpenChatBot";

const WELCOME_MESSAGES: &[&str] = &[
    "Welcome to OpenChat!",
    "I am the OpenChat bot. I will send you messages to let you know about events that don't belong to any other chat, such as if crypto has been deposited into your OpenChat account(s) or if you've been removed from a group. In the future you'll be able to ask me questions or send me commands.",
    "To follow all the updates to OpenChat, join the [OpenChat Updates](/#/eucat-raaaa-aaaaf-adn7q-cai) group.",
    "To request new features, join the [Feature Requests](/#/vfaj4-zyaaa-aaaaf-aabya-cai) group.",
    "To report bugs, join the [Bug Reports](/#/sycha-wyaaa-aaaaf-aabka-cai) group.",
    "To provide feedback in general, join the [Product Feedback](/#/s7dbu-3aaaa-aaaaf-aabkq-cai) group.",
    "Please keep posts relevant to each group. If you just want to say \"hi\", post in the [OpenChat group](/#/vmdca-pqaaa-aaaaf-aabzq-cai)."];

pub(crate) fn send_welcome_messages() {
    mutate_state(|state| {
        if !bot_chat_exists(state) {
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
    let visibility = if public { "Public" } else { "Private" };

    let text = format!(
        "The group _{} ({})_ was deleted by @UserId({})",
        group_name, visibility, deleted_by
    );

    send_text_message(text, runtime_state);
}

pub(crate) fn send_removed_from_group_message(
    removed_by: UserId,
    group_name: String,
    public: bool,
    blocked: bool,
    runtime_state: &mut RuntimeState,
) {
    let visibility = if public { "Public" } else { "Private" };
    let action = if blocked { "blocked" } else { "removed" };
    let text = format!("You were {action} from the group _{group_name} ({visibility})_ by @UserId({removed_by})");

    send_text_message(text, runtime_state);
}

pub(crate) fn send_phone_number_confirmed_bot_message(event: &PhoneNumberConfirmed, runtime_state: &mut RuntimeState) {
    let storage_added = to_gb(event.storage_added);
    let new_group_limit = PREMIUM_GROUP_CREATION_LIMIT.to_string();
    let old_group_limit = BASIC_GROUP_CREATION_LIMIT.to_string();
    let text = format!("Thank you for [verifying ownership of your phone number](/#/{OPENCHAT_BOT_USER_ID}?faq=sms_icp). This gives you {storage_added} GB of storage allowing you to send and store images, videos, audio and other files. It also entitles you to create {new_group_limit} groups (up from {old_group_limit}).");

    send_text_message(text, runtime_state);
}

pub(crate) fn send_storage_ugraded_bot_message(event: &StorageUpgraded, runtime_state: &mut RuntimeState) {
    let amount_paid = to_tokens(event.cost.amount);
    let token = event.cost.token.token_symbol();
    let storage_added = to_gb(event.storage_added);
    let storage_total = to_gb(event.new_storage_limit);
    let new_group_limit = PREMIUM_GROUP_CREATION_LIMIT.to_string();
    let old_group_limit = BASIC_GROUP_CREATION_LIMIT.to_string();

    let text = if event.storage_added == event.new_storage_limit {
        format!("Thank you for [buying storage](/#/{OPENCHAT_BOT_USER_ID}?faq=sms_icp). You paid {amount_paid} {token} for {storage_added} GB of storage. This will allow you to send and store images, videos, audio and other files. It also entitles you to create {new_group_limit} groups (up from {old_group_limit}).")
    } else {
        format!("Thank you for buying more storage. You paid {amount_paid} {token} for {storage_added} GB of storage giving you {storage_total} GB in total.")
    };

    send_text_message(text, runtime_state);
}

pub(crate) fn send_referred_user_joined_message(event: &ReferredUserRegistered, runtime_state: &mut RuntimeState) {
    let user_id = event.user_id;

    let text = format!("User @UserId({user_id}) has just registered with your referral code!");

    send_text_message(text, runtime_state);
}

pub(crate) fn send_voted_on_proposal_message(
    governance_canister_id: CanisterId,
    proposal_id: ProposalId,
    adopt: bool,
    voted: &[NeuronId],
    unable_to_vote: &[(NeuronId, String)],
    errors: &[(NeuronId, String)],
    runtime_state: &mut RuntimeState,
) {
    let mut text = String::new();
    if !voted.is_empty() {
        writeln!(&mut text, "Vote recorded.").unwrap();
    } else {
        writeln!(&mut text, "Failed to record vote").unwrap();
    }
    writeln!(&mut text).unwrap();
    writeln!(&mut text, "Governance canister Id: {governance_canister_id}").unwrap();
    writeln!(&mut text, "Proposal Id: {proposal_id}").unwrap();
    writeln!(&mut text, "Adopt: {}", if adopt { "Yes" } else { "No" }).unwrap();
    writeln!(&mut text).unwrap();
    if voted.is_empty() && unable_to_vote.is_empty() && errors.is_empty() {
        writeln!(&mut text).unwrap();
        writeln!(&mut text, "No linked neurons found").unwrap();
        writeln!(&mut text, "In order to vote on proposals from within OpenChat, you must first add your OpenChat UserId as a hotkey to any neurons you wish to vote with").unwrap();
        writeln!(&mut text, "Your OpenChat UserId is {}", runtime_state.env.canister_id()).unwrap();
    } else {
        if !voted.is_empty() {
            writeln!(&mut text, "The following neurons voted:").unwrap();
            for n in voted {
                writeln!(&mut text, "{n}").unwrap();
            }
        }

        if !unable_to_vote.is_empty() {
            writeln!(&mut text).unwrap();
            writeln!(&mut text, "The following neurons were unable to vote:").unwrap();
            for (n, e) in unable_to_vote {
                writeln!(&mut text, "{n} - {e}").unwrap();
            }
        }

        if !errors.is_empty() {
            writeln!(&mut text).unwrap();
            writeln!(
                &mut text,
                "An error occurred while trying to vote with the following neurons:"
            )
            .unwrap();
            for (n, e) in errors {
                writeln!(&mut text, "{n} - {e}").unwrap();
            }
        }
    }

    send_text_message(text, runtime_state);
}

fn to_gb(bytes: u64) -> String {
    const BYTES_PER_1GB: u64 = 1024 * 1024 * 1024;
    format_to_decimal_places(bytes as f64 / BYTES_PER_1GB as f64, 2)
}

fn to_tokens(tokens: Tokens) -> String {
    const E8S_PER_TOKEN: u64 = 100_000_000;
    format_to_decimal_places(tokens.e8s() as f64 / E8S_PER_TOKEN as f64, 8)
}

fn send_text_message(text: String, runtime_state: &mut RuntimeState) {
    let content = MessageContent::Text(TextContent { text });
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

    let message_id = MessageId::generate(|| runtime_state.env.random_u32());

    let args = c2c_send_message::Args {
        message_id,
        sender_message_index: message_index,
        sender_name: OPENCHAT_BOT_USERNAME.to_string(),
        content,
        replies_to_v2: None,
        forwarding: false,
    };

    c2c_send_message_impl(OPENCHAT_BOT_USER_ID, args, mute_notification, runtime_state);
}

fn bot_chat_exists(runtime_state: &RuntimeState) -> bool {
    runtime_state.data.direct_chats.get(&OPENCHAT_BOT_USER_ID.into()).is_some()
}
