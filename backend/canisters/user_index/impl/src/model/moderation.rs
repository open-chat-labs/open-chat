use crate::RuntimeState;
use crate::model::reported_messages::category_names;
use crate::timer_job_types::{SetUserSuspended, TimerJob};
use chat_events::deep_message_links;
use constants::OPENCHAT_BOT_USER_ID;
use fire_and_forget_handler::FireAndForgetHandler;
use tracing::error;
use types::{
    CanisterId, ChannelId, Chat, MessageId, MessageIndex, ModerationCategories, SuspensionDuration, TimestampMillis, UserId,
};

const MAX_EXCERPT_LENGTH: usize = 500;

pub struct ModerationAlert {
    pub chat_id: Chat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub sender: UserId,
    // Empty if the alert was triggered by the automated moderation pipeline rather than a report
    pub reporters: Vec<UserId>,
    pub categories: ModerationCategories,
    pub auto_sanctioned: bool,
    pub content_excerpt: Option<String>,
    pub timestamp: TimestampMillis,
}

// Posts an alert into the internal moderation channel as the OpenChat bot
pub fn post_moderation_alert(alert: ModerationAlert, state: &mut RuntimeState) {
    let Some((community_id, channel_id)) = state.data.internal_moderation_channel else {
        error!("Content requires moderator review but no internal moderation channel is configured");
        return;
    };

    let is_csam = alert.categories.contains(ModerationCategories::SEXUAL_MINORS);

    let mut text = String::new();
    if is_csam {
        text.push_str("⚠️ **CSAM detected** — retain this alert for legal record-keeping\n\n");
    } else {
        text.push_str("Content escalated for moderator review\n\n");
    }

    let link = deep_message_links::build_message_link(alert.chat_id, alert.thread_root_message_index, alert.message_index);
    text.push_str(&format!("Message: {link}\n"));
    text.push_str(&format!("Sender: {}\n", alert.sender));

    if alert.reporters.is_empty() {
        text.push_str("Detected by: automated moderation pipeline\n");
    } else {
        let reporters: Vec<String> = alert.reporters.iter().map(|r| r.to_string()).collect();
        text.push_str(&format!("Reported by: {}\n", reporters.join(", ")));
    }

    let categories = if alert.categories.is_empty() {
        "none (report reason could not be evaluated automatically)".to_string()
    } else {
        category_names(alert.categories).join(", ")
    };
    text.push_str(&format!("Flagged categories: {categories}\n"));

    text.push_str(&format!("Timestamp: {}\n", alert.timestamp));

    if alert.auto_sanctioned {
        text.push_str("Action: auto-sanctioned (message deleted, sender suspended)\n");
    } else {
        text.push_str("Action: requires human review\n");
    }

    if let Some(excerpt) = alert.content_excerpt.as_ref().filter(|e| !e.trim().is_empty()) {
        let excerpt: String = excerpt.chars().take(MAX_EXCERPT_LENGTH).collect();
        text.push_str(&format!("\nContent:\n> {}\n", excerpt.replace('\n', "\n> ")));
    }

    let args = community_canister::c2c_send_moderation_report::Args { channel_id, text };
    state.data.fire_and_forget_handler.send(
        community_id.into(),
        "c2c_send_moderation_report_msgpack".to_string(),
        msgpack::serialize_then_unwrap(&args),
    );
}

pub fn delete_message(
    chat_id: Chat,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    fire_and_forget_handler: &mut FireAndForgetHandler,
) {
    match chat_id {
        Chat::Group(group_id) => delete_group_message(
            group_id.into(),
            thread_root_message_index,
            message_id,
            fire_and_forget_handler,
        ),
        Chat::Channel(community_id, channel_id) => delete_channel_message(
            community_id.into(),
            channel_id,
            thread_root_message_index,
            message_id,
            fire_and_forget_handler,
        ),
        // Don't delete messages from direct chats - the reporter can delete it themselves
        Chat::Direct(_) => (),
    }
}

fn delete_channel_message(
    canister_id: CanisterId,
    channel_id: ChannelId,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    fire_and_forget_handler: &mut FireAndForgetHandler,
) {
    let args = community_canister::delete_messages::Args {
        channel_id,
        thread_root_message_index,
        message_ids: vec![message_id],
        as_platform_moderator: Some(true),
        new_achievement: false,
    };
    fire_and_forget_handler.send(
        canister_id,
        "delete_messages_msgpack".to_string(),
        msgpack::serialize_then_unwrap(&args),
    );
}

fn delete_group_message(
    canister_id: CanisterId,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    fire_and_forget_handler: &mut FireAndForgetHandler,
) {
    let args = group_canister::delete_messages::Args {
        thread_root_message_index,
        message_ids: vec![message_id],
        as_platform_moderator: Some(true),
        new_achievement: false,
    };
    fire_and_forget_handler.send(
        canister_id,
        "delete_messages_msgpack".to_string(),
        msgpack::serialize_then_unwrap(&args),
    );
}

pub fn suspend_sender(sender: UserId, now: TimestampMillis, state: &mut RuntimeState) {
    let Some(user) = state.data.users.get_by_user_id(&sender) else {
        error!(%sender, "Cannot suspend message sender, user not found");
        return;
    };

    if user
        .suspension_details
        .as_ref()
        .is_some_and(|d| matches!(d.duration, SuspensionDuration::Indefinitely))
    {
        return;
    }

    state.data.timer_jobs.enqueue_job(
        TimerJob::SetUserSuspended(SetUserSuspended {
            user_id: sender,
            duration: None,
            reason: "The message depicts, promotes or attempts to normalize child sexual abuse".to_string(),
            suspended_by: OPENCHAT_BOT_USER_ID,
        }),
        now,
        now,
    );
}
