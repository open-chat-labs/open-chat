use crate::RuntimeState;
use crate::model::moderation::{self, ModerationAlert};
use crate::model::reported_messages::{AddProactiveDetectionArgs, ModerationAction, ProactiveDetectionResult, latest_chat};
use tracing::info;
use types::ModerationCategories;
use user_index_canister::CsamDetected as Args;

pub(crate) fn c2c_csam_detected_impl(mut args: Args, state: &mut RuntimeState) {
    // Until the job replacing the ids users had before being migrated to a MultiUser canister (#9929)
    // has completed everywhere, a chat can still name the sender by an old id. Remove along with the
    // rest of the mapping of old ids to new once it has.
    args.sender = state.data.migrated_user_ids.latest(args.sender);
    args.chat_id = latest_chat(args.chat_id, &state.data.migrated_user_ids);

    let now = state.env.now();
    let categories = ModerationCategories::from_bits(args.flags).unwrap_or(ModerationCategories::SEXUAL_MINORS);

    // Only a media hash match (known material) suspends before a verdict. A text classifier
    // flag judges a single message without its context and has a real false-positive rate, so
    // it protects (delete + quarantine) and escalates, and the suspension waits for a moderator.
    let suspend_sender = !args.media_matches.is_empty();

    // Create a resolvable report so that the detection can be reviewed: upheld, dismissed
    // (which reverses it), or contested by the sender. If an outcome already exists this is a
    // duplicate event and nothing may re-apply - unless it is a hash match upgrading an outcome
    // which did not suspend.
    let report_index = match state
        .data
        .reported_messages
        .add_proactive_detection(AddProactiveDetectionArgs {
            action: ModerationAction::AutoSanctioned,
            chat_id: args.chat_id,
            thread_root_message_index: args.thread_root_message_index,
            message_index: args.message_index,
            message_id: args.message_id,
            sender: args.sender,
            flags: categories.bits(),
            blob_references: args.blob_references.clone(),
            media_matches: args.media_matches.clone(),
            // Persisted (not just shown on the alert): the message is deleted below, and the
            // authority filing later needs the flagged text
            content_excerpt: args.content_excerpt.clone(),
            suspend_sender,
            timestamp: now,
        }) {
        ProactiveDetectionResult::New(report_index) => {
            // Record the report against the sender's user record (feeds the repeat-offender
            // count). Only for new reports: filling in an existing user report would
            // double-count the index.
            state.data.users.push_reported_message(args.sender, report_index);
            report_index
        }
        ProactiveDetectionResult::FilledUserReport(report_index) => report_index,
        ProactiveDetectionResult::UpgradedToSanction(report_index) => {
            apply_upgraded_sanction(report_index, &args, categories, now, state);
            return;
        }
        ProactiveDetectionResult::OutcomeExists => {
            info!("CSAM detection ignored: report already has an outcome");
            return;
        }
    };

    let reported_message = state.data.reported_messages.get(report_index).unwrap().clone();

    // Quarantine media in the evidence vault first: this blocks public serving and pins the
    // blobs against every deletion path, preserving evidence ahead of the deletion
    moderation::quarantine_blobs(report_index, &reported_message, categories.bits(), state);

    // The flag was already set in-canister by the detecting chat canister before it escalated;
    // re-asserting it in the same message as the deletion is idempotent and makes the read gate
    // hold even if that write was lost
    moderation::delete_and_flag_message(
        args.chat_id,
        args.thread_root_message_index,
        args.message_id,
        categories.bits(),
        false,
        state,
    );
    if suspend_sender {
        moderation::suspend_sender(args.sender, Some(report_index), now, state);
    }

    moderation::post_moderation_alert(
        ModerationAlert {
            report_index: Some(report_index),
            chat_id: args.chat_id,
            thread_root_message_index: args.thread_root_message_index,
            message_index: args.message_index,
            message_id: args.message_id,
            sender: args.sender,
            reporters: Vec::new(),
            categories,
            classification_failed: false,
            auto_sanctioned: true,
            content_excerpt: args.content_excerpt,
            blob_references: reported_message.blob_references,
            media_matches: args.media_matches,
            timestamp: now,
            authority_report: None,
            is_blocked_attempt: false,
            status: types::ModerationReportStatus::Pending,
        },
        state,
    );
}

// A hash match on a message whose report is already open without a suspension (a text flag, a
// reporter assertion, or a referral): the report and its alert already exist, so this applies
// the takedown and the suspension, flips the alert to the quarantined path and tells the
// moderators why it changed
fn apply_upgraded_sanction(
    report_index: u64,
    args: &Args,
    categories: ModerationCategories,
    now: types::TimestampMillis,
    state: &mut RuntimeState,
) {
    let Some(reported_message) = state.data.reported_messages.get(report_index).cloned() else {
        return;
    };

    moderation::quarantine_blobs(report_index, &reported_message, categories.bits(), state);
    moderation::delete_and_flag_message(
        args.chat_id,
        args.thread_root_message_index,
        args.message_id,
        categories.bits(),
        reported_message.already_deleted,
        state,
    );
    moderation::suspend_sender(args.sender, Some(report_index), now, state);
    moderation::update_moderation_alert_quarantined(&reported_message, state);
    moderation::post_moderation_notice(
        format!(
            "Report #{report_index}: the message's media has now matched known CSAM by hash, so the sender has been suspended pending your verdict."
        ),
        state,
    );
}
