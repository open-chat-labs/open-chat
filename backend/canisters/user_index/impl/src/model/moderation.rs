use crate::RuntimeState;
use crate::model::reported_messages::ReportedMessage;
use crate::timer_job_types::{SetUserSuspended, TimerJob, UnsuspendUser};
use constants::{DAY_IN_MS, OPENCHAT_BOT_USER_ID};
use fire_and_forget_handler::FireAndForgetHandler;
use rand::Rng;
use storage_bucket_canister::c2c_vault_sync::VaultCaptureMetadata;
use storage_index_canister::c2c_vault_ops::{ApplyVerdictOp, Args as VaultOpsArgs, QuarantineOp, VaultOp};
use tracing::error;
use types::{BlobReference, Milliseconds};
use types::{
    CanisterId, ChannelId, Chat, MessageId, MessageIndex, ModerationCategories, ModerationReportContent,
    ModerationReportStatus, SuspensionDuration, TimestampMillis, UserId,
};

const MAX_EXCERPT_LENGTH: usize = 500;

pub struct ModerationAlert {
    // None if this alert came from the automated pipeline, in which case there is no report to
    // resolve and the alert is a record only
    pub report_index: Option<u64>,
    pub chat_id: Chat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sender: UserId,
    // Empty if the alert was triggered by the automated moderation pipeline rather than a report
    pub reporters: Vec<UserId>,
    pub categories: ModerationCategories,
    pub auto_sanctioned: bool,
    pub content_excerpt: Option<String>,
    pub blob_references: Vec<BlobReference>,
    pub timestamp: TimestampMillis,
}

// Posts an alert into the internal moderation channel as the OpenChat bot
pub fn post_moderation_alert(alert: ModerationAlert, state: &mut RuntimeState) {
    let Some((community_id, channel_id)) = state.data.internal_moderation_channel else {
        error!("Content requires moderator review but no internal moderation channel is configured");
        return;
    };

    let channel_message_id: MessageId = state.env.rng().r#gen::<u128>().into();

    let report = ModerationReportContent {
        report_index: alert.report_index,
        chat_id: alert.chat_id,
        thread_root_message_index: alert.thread_root_message_index,
        message_index: alert.message_index,
        message_id: alert.message_id,
        sender: alert.sender,
        reporters: alert.reporters,
        flagged_categories: alert.categories.bits(),
        auto_sanctioned: alert.auto_sanctioned,
        content_excerpt: alert
            .content_excerpt
            .as_ref()
            .filter(|e| !e.trim().is_empty())
            .map(|e| e.chars().take(MAX_EXCERPT_LENGTH).collect()),
        blob_references: alert.blob_references,
        reported_at: alert.timestamp,
        status: ModerationReportStatus::Pending,
    };

    if let Some(report_index) = alert.report_index {
        state
            .data
            .reported_messages
            .set_moderation_channel_message_id(report_index, channel_message_id);
    }

    let args = community_canister::c2c_send_moderation_report::Args {
        channel_id,
        message_id: channel_message_id,
        report,
    };
    state.data.fire_and_forget_handler.send(
        community_id.into(),
        "c2c_send_moderation_report_msgpack".to_string(),
        msgpack::serialize_then_unwrap(&args),
    );
}

// Updates the status shown on the alert message in the internal moderation channel
pub fn update_moderation_alert_status(
    reported_message: &ReportedMessage,
    status: ModerationReportStatus,
    state: &mut RuntimeState,
) {
    let Some((community_id, channel_id)) = state.data.internal_moderation_channel else {
        return;
    };
    let Some(message_id) = reported_message.moderation_channel_message_id else {
        return;
    };

    let args = community_canister::c2c_update_moderation_report_status::Args {
        channel_id,
        message_id,
        status,
    };
    state.data.fire_and_forget_handler.send(
        community_id.into(),
        "c2c_update_moderation_report_status_msgpack".to_string(),
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

pub fn set_message_moderation_flags(
    chat_id: Chat,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    flags: u32,
    fire_and_forget_handler: &mut FireAndForgetHandler,
) {
    match chat_id {
        Chat::Group(group_id) => {
            let args = group_canister::c2c_flag_message::Args {
                thread_root_message_index,
                message_id,
                flags,
            };
            fire_and_forget_handler.send(
                group_id.into(),
                "c2c_flag_message_msgpack".to_string(),
                msgpack::serialize_then_unwrap(&args),
            );
        }
        Chat::Channel(community_id, channel_id) => {
            let args = community_canister::c2c_flag_message::Args {
                channel_id,
                thread_root_message_index,
                message_id,
                flags,
            };
            fire_and_forget_handler.send(
                community_id.into(),
                "c2c_flag_message_msgpack".to_string(),
                msgpack::serialize_then_unwrap(&args),
            );
        }
        Chat::Direct(_) => {}
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

// Suspends the sender of CSAM indefinitely
pub fn suspend_sender(sender: UserId, now: TimestampMillis, state: &mut RuntimeState) {
    suspend(
        sender,
        None,
        "The message depicts, promotes or attempts to normalize child sexual abuse".to_string(),
        now,
        state,
    );
}

// Suspends the sender of a message which a platform moderator has judged to break the platform
// rules: for a day, or indefinitely for repeat offenders
pub fn suspend_sender_for_upheld_violation(sender: UserId, now: TimestampMillis, state: &mut RuntimeState) {
    let (duration, reason) = if in_breach_count(sender, state) > 2 {
        (None, "Multiple violations of the platform rules".to_string())
    } else {
        (Some(DAY_IN_MS), "Violation of platform rules".to_string())
    };

    suspend(sender, duration, reason, now, state);
}

fn suspend(sender: UserId, duration: Option<u64>, reason: String, now: TimestampMillis, state: &mut RuntimeState) {
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
            duration,
            reason,
            suspended_by: OPENCHAT_BOT_USER_ID,
        }),
        now,
        now,
    );
}

// Restores a message after a Dismissed verdict on an automated sanction (receiver implemented
// in the group/community canisters). Direct chats are never deleted by moderation, so there is
// nothing to restore.
pub fn undelete_message(
    chat_id: Chat,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    fire_and_forget_handler: &mut FireAndForgetHandler,
) {
    match chat_id {
        Chat::Group(group_id) => {
            let args = group_canister::c2c_moderation_undelete::Args {
                thread_root_message_index,
                message_id,
            };
            fire_and_forget_handler.send(
                group_id.into(),
                "c2c_moderation_undelete_msgpack".to_string(),
                msgpack::serialize_then_unwrap(&args),
            );
        }
        Chat::Channel(community_id, channel_id) => {
            let args = community_canister::c2c_moderation_undelete::Args {
                channel_id,
                thread_root_message_index,
                message_id,
            };
            fire_and_forget_handler.send(
                community_id.into(),
                "c2c_moderation_undelete_msgpack".to_string(),
                msgpack::serialize_then_unwrap(&args),
            );
        }
        Chat::Direct(_) => (),
    }
}

// Permanently removes the chat-canister copy after an Upheld verdict (receiver implemented in
// the group/community canisters). For CSAM the vault copy persists under the retention regime.
pub fn hard_delete_message(
    chat_id: Chat,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    fire_and_forget_handler: &mut FireAndForgetHandler,
) {
    match chat_id {
        Chat::Group(group_id) => {
            let args = group_canister::c2c_moderation_hard_delete::Args {
                thread_root_message_index,
                message_id,
            };
            fire_and_forget_handler.send(
                group_id.into(),
                "c2c_moderation_hard_delete_msgpack".to_string(),
                msgpack::serialize_then_unwrap(&args),
            );
        }
        Chat::Channel(community_id, channel_id) => {
            let args = community_canister::c2c_moderation_hard_delete::Args {
                channel_id,
                thread_root_message_index,
                message_id,
            };
            fire_and_forget_handler.send(
                community_id.into(),
                "c2c_moderation_hard_delete_msgpack".to_string(),
                msgpack::serialize_then_unwrap(&args),
            );
        }
        Chat::Direct(_) => (),
    }
}

// Conservative default retention for vaulted evidence: 1 year from report filing, per
// 18 U.S.C. 2258A(h) and reg 8 SI 2026/268
const VAULT_RETENTION_MS: Milliseconds = 365 * DAY_IN_MS;

fn send_vault_ops(ops: Vec<VaultOp>, state: &mut RuntimeState) {
    if ops.is_empty() {
        return;
    }
    let args = VaultOpsArgs { ops };
    state.data.fire_and_forget_handler.send(
        state.data.storage_index_canister_id,
        "c2c_vault_ops".to_string(),
        candid::encode_one(&args).unwrap(),
    );
}

// Quarantines the report's media in the evidence vault: blocks public serving, pins the blobs
// against deletion, and captures chain-of-custody metadata
pub fn quarantine_blobs(report_index: u64, report: &ReportedMessage, flags: u32, state: &mut RuntimeState) {
    let ops = quarantine_ops(report_index, report, flags, state.env.now());
    send_vault_ops(ops, state);
}

// Quarantine plus the uphold verdict in a single message, so the bucket processes them in
// order: separate fire-and-forget sends carry no ordering guarantee, and a verdict arriving
// before its quarantine would be dropped, leaving the blob retained with no retention clock
pub fn quarantine_blobs_and_apply_verdict(report_index: u64, report: &ReportedMessage, flags: u32, state: &mut RuntimeState) {
    let now = state.env.now();
    let mut ops = quarantine_ops(report_index, report, flags, now);
    ops.extend(verdict_ops(&report.blob_references, now));
    send_vault_ops(ops, state);
}

fn quarantine_ops(report_index: u64, report: &ReportedMessage, flags: u32, now: TimestampMillis) -> Vec<VaultOp> {
    report
        .blob_references
        .iter()
        .map(|blob_reference| {
            VaultOp::Quarantine(QuarantineOp {
                blob_reference: blob_reference.clone(),
                metadata: VaultCaptureMetadata {
                    report_index,
                    chat: report.chat_id,
                    message_index: report.message_index,
                    message_id: report.message_id,
                    sender: report.sender,
                    detection_timestamp: now,
                    classifier_categories: flags,
                },
            })
        })
        .collect()
}

pub fn unquarantine_blobs(blob_references: &[BlobReference], state: &mut RuntimeState) {
    let ops = blob_references.iter().cloned().map(VaultOp::Unquarantine).collect();
    send_vault_ops(ops, state);
}

// Applies the uphold verdict to the vault: the retention clock starts and the blob is deleted
// only when it expires (never while a legal hold is set)
pub fn apply_vault_verdict(blob_references: &[BlobReference], state: &mut RuntimeState) {
    let ops = verdict_ops(blob_references, state.env.now());
    send_vault_ops(ops, state);
}

fn verdict_ops(blob_references: &[BlobReference], now: TimestampMillis) -> Vec<VaultOp> {
    let retention_until = now + VAULT_RETENTION_MS;
    blob_references
        .iter()
        .cloned()
        .map(|blob_reference| {
            VaultOp::ApplyVerdict(ApplyVerdictOp {
                blob_reference,
                retention_until,
            })
        })
        .collect()
}

// Pushes the current vault-reviewer principal set to the storage buckets (via the storage
// index). Called on any change to the reviewer set, and on moderator-revocation cascade.
pub fn sync_vault_reviewers(state: &mut RuntimeState) {
    let principals = state
        .data
        .vault_reviewers
        .iter()
        .filter_map(|user_id| state.data.users.get_by_user_id(user_id).map(|u| u.principal))
        .collect();
    send_vault_ops(vec![VaultOp::SetReviewers(principals)], state);
}

// Lifts a suspension after a Dismissed verdict on an automated sanction
pub fn unsuspend_sender(sender: UserId, now: TimestampMillis, state: &mut RuntimeState) {
    state
        .data
        .timer_jobs
        .enqueue_job(TimerJob::UnsuspendUser(UnsuspendUser { user_id: sender }), now, now);
}

// Replaces an indefinite CSAM suspension with the standard severity for an upheld (non-CSAM)
// violation. Enqueues directly, bypassing the already-indefinitely-suspended guard in suspend()
// since a downgrade is exactly what is intended here.
pub fn downgrade_suspension_to_upheld_violation(sender: UserId, now: TimestampMillis, state: &mut RuntimeState) {
    let (duration, reason) = if in_breach_count(sender, state) > 2 {
        (None, "Multiple violations of the platform rules".to_string())
    } else {
        (Some(DAY_IN_MS), "Violation of platform rules".to_string())
    };

    state.data.timer_jobs.enqueue_job(
        TimerJob::SetUserSuspended(SetUserSuspended {
            user_id: sender,
            duration,
            reason,
            suspended_by: OPENCHAT_BOT_USER_ID,
        }),
        now,
        now,
    );
}

fn in_breach_count(sender: UserId, state: &RuntimeState) -> usize {
    state
        .data
        .users
        .get_by_user_id(&sender)
        .map(|user| {
            user.reported_messages
                .iter()
                .filter_map(|i| state.data.reported_messages.get(*i))
                .filter(|r| r.in_breach())
                .count()
        })
        .unwrap_or_default()
}

// True if the sender has another unresolved automated sanction besides `except_report_index` -
// in which case a Dismissed verdict on one report must not lift the suspension
pub fn has_other_unresolved_auto_sanction(sender: UserId, except_report_index: u64, state: &RuntimeState) -> bool {
    state
        .data
        .users
        .get_by_user_id(&sender)
        .map(|user| {
            user.reported_messages
                .iter()
                .filter(|i| **i != except_report_index)
                .filter_map(|i| state.data.reported_messages.get(*i))
                .any(|r| {
                    matches!(
                        r.automated_action(),
                        Some(crate::model::reported_messages::ModerationAction::AutoSanctioned)
                    ) && !r.has_human_verdict()
                })
        })
        .unwrap_or_default()
}
