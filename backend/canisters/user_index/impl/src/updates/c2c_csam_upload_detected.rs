use crate::guards::caller_is_storage_index;
use crate::model::moderation;
use crate::model::reported_messages::build_upload_sanction_message_to_uploader;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use tracing::warn;
use user_index_canister::c2c_csam_upload_detected::*;

// A storage bucket refused an attempt to upload or forward content whose hash matches
// either a previous UpheldAsCsam verdict (a KNOWING attempt to post confirmed CSAM) or a
// blob still quarantined awaiting its verdict (the same hash-match signal which sanctioned
// the original sender). No message exists (the attempt was blocked at the bucket); the
// uploader receives the same provisional sanction as the original sender, tied to the same
// report so its resolution governs both, and the internal moderation channel gets the alarm.
//
// Deliberately NOT handled here: existing pre-verdict copies of the content. Every reported
// copy gets its own human verdict, and the denylist only gates FUTURE uploads - a verdict on
// one report is never applied retrospectively to messages that have already been reviewed
// (or are still awaiting review).
#[update(guard = "caller_is_storage_index", msgpack = true)]
#[trace]
fn c2c_csam_upload_detected(args: Args) -> Response {
    mutate_state(|state| c2c_csam_upload_detected_impl(args, state));
    Response::Success
}

fn c2c_csam_upload_detected_impl(args: Args, state: &mut RuntimeState) {
    let now = state.env.now();

    for m in args.matches {
        let uploader = state
            .data
            .users
            .get_by_principal(&m.uploader)
            .map(|u| (u.user_id, u.username.clone()));

        warn!(
            uploader = %m.uploader,
            file_id = %m.file_id,
            csam_report_index = m.csam_report_index,
            kind = ?m.kind,
            "Attempt to post known CSAM content"
        );

        let (action, status_phrase) = match m.kind {
            CsamMatchKind::UploadAttempt => ("upload", "upheld as CSAM"),
            CsamMatchKind::ForwardAttempt => ("forward", "upheld as CSAM"),
            CsamMatchKind::PendingQuarantineAttempt => ("re-post", "quarantined pending review"),
            // The inert default for events which predate the kind field: treat conservatively
            // (no way to know it was a knowing post-verdict act, so no sanction)
            CsamMatchKind::ExistingCopy => continue,
        };
        let verdict_pending = matches!(m.kind, CsamMatchKind::PendingQuarantineAttempt);

        if let Some((user_id, _)) = &uploader {
            moderation::suspend_sender(*user_id, now, state);
            // Recorded so the user can require human review (Article 22) and so an unrelated
            // report's dismissal cannot lift it; tied to the ORIGINAL report - for a pending
            // quarantine hit, that report's resolution governs this sanction too
            state
                .data
                .users
                .record_csam_upload_sanction(*user_id, m.csam_report_index, now);
            state
                .push_event_to_local_user_index(*user_id, build_upload_sanction_message_to_uploader(*user_id, verdict_pending));

            // Each blocked attempt is an offence in its own right and owes its own authority
            // (NCA) report, so it gets a first-class resolvable report - not just a channel
            // notice. Anchored to the original report's evidence; None when this attempter
            // already has an attempt report for that content (a retry is not a new offence
            // record) or the original report index is unknown.
            if let Some((attempt_report_index, attempt_report)) =
                state
                    .data
                    .reported_messages
                    .add_blocked_attempt_report(m.csam_report_index, *user_id, now)
            {
                if !verdict_pending {
                    // The content was already adjudicated CSAM; the only new fact is the
                    // attempter, so the authority report is due immediately (hash-only filing
                    // - the NCA matches the hash on their side, nobody re-views the content)
                    state.data.authority_reports.push_due(attempt_report_index, false, now);
                }
                moderation::post_moderation_alert(
                    moderation::ModerationAlert {
                        report_index: Some(attempt_report_index),
                        chat_id: attempt_report.chat_id,
                        thread_root_message_index: attempt_report.thread_root_message_index,
                        message_index: attempt_report.message_index,
                        message_id: attempt_report.message_id,
                        sender: *user_id,
                        reporters: Vec::new(),
                        categories: types::ModerationCategories::SEXUAL_MINORS,
                        classification_failed: false,
                        auto_sanctioned: true,
                        content_excerpt: Some(format!(
                            "[blocked attempt to {action} content {status_phrase} in report #{}]",
                            m.csam_report_index
                        )),
                        blob_references: attempt_report.blob_references.clone(),
                        media_matches: attempt_report.media_matches.clone(),
                        authority_report: (!verdict_pending).then_some(types::AuthorityReportState::Due { urgent: false }),
                        timestamp: now,
                    },
                    state,
                );
            }
        } else {
            // No resolvable user means no sanction and no report to anchor: fall back to a
            // plain notice so the attempt is at least visible to the moderators
            let text = format!(
                "🚨 Attempt to post blocked content\n\n\
                 An unrecognised principal ({}) tried to {action} content {status_phrase} in report #{}. \
                 The attempt was blocked and no message was created. \
                 The user could not be resolved, so NO suspension was applied.",
                m.uploader, m.csam_report_index
            );
            moderation::post_moderation_notice(text, state);
        }
    }
}
