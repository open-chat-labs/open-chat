use crate::guards::caller_is_storage_index;
use crate::model::moderation;
use crate::model::reported_messages::{AddBlockedAttemptResult, ReportedMessages, build_upload_sanction_message_to_uploader};
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use tracing::warn;
use user_index_canister::c2c_csam_upload_detected::*;
use user_index_canister::resolve_moderation_report::ModerationVerdict;

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

        if let Some((user_id, username)) = &uploader {
            let who = format!("@{username} ({user_id})");
            moderation::suspend_sender(*user_id, now, state);
            // Recorded so the user can require human review (Article 22) and so an unrelated
            // report's dismissal cannot lift it; tied to the ORIGINAL report - for a pending
            // quarantine hit, that report's resolution governs this sanction too
            state
                .data
                .users
                .record_csam_upload_sanction(*user_id, m.csam_report_index, now);

            // Each blocked attempt is a fresh offence and owes its own authority (NCA)
            // report, so it gets its own first-class report anchored to the original report's
            // evidence. Guards in add_blocked_attempt_report keep that honest: attempts
            // within the client-retry window, or beyond the per-offender report cap, tally
            // onto the latest report (still available to the authority filing) and surface
            // as a notice instead.
            match state
                .data
                .reported_messages
                .add_blocked_attempt_report(m.csam_report_index, *user_id, now)
            {
                Some(AddBlockedAttemptResult::Repeat {
                    attempt_report_index,
                    total_attempts,
                }) => {
                    state.push_event_to_local_user_index(
                        *user_id,
                        build_upload_sanction_message_to_uploader(*user_id, verdict_pending),
                    );
                    let text = format!(
                        "🚨 Repeat attempt to {action} content {status_phrase} in report #{} \
                         ({who}, attempt {total_attempts}; recorded on attempt report #{attempt_report_index}). \
                         The attempt was blocked and no message was created.",
                        m.csam_report_index
                    );
                    moderation::post_moderation_notice(text, state);
                }
                Some(AddBlockedAttemptResult::New {
                    attempt_report_index,
                    report: attempt_report,
                }) => {
                    // The report is registered on the attempter like any other, so the
                    // sanction helpers (strike counts, other-active-sanction checks, contest)
                    // can see it
                    state.data.users.push_reported_message(*user_id, attempt_report_index);

                    // The side effects derive from the report's ACTUAL state, not the bucket's
                    // match kind: this call is async, so the original report can resolve (or a
                    // legal hold can change the picture) before the event lands
                    let inherited = attempt_report.human_verdict().map(|v| v.verdict);
                    state.push_event_to_local_user_index(
                        *user_id,
                        build_upload_sanction_message_to_uploader(*user_id, inherited.is_none()),
                    );
                    match inherited {
                        Some(ModerationVerdict::UpheldAsCsam) => {
                            // Adjudicated content: the attempt's authority report is due
                            // immediately (hash-only filing - the NCA matches the hash
                            // server-side, nobody re-views the content)
                            state.data.authority_reports.push_due(attempt_report_index, false, now);
                        }
                        Some(ModerationVerdict::Upheld) => {
                            state
                                .data
                                .users
                                .clear_csam_upload_sanction_if_for_report(user_id, m.csam_report_index);
                            moderation::downgrade_suspension_to_upheld_violation(*user_id, attempt_report_index, now, state);
                        }
                        Some(ModerationVerdict::Dismissed) => {
                            // The content was already cleared: reverse the sanction right away.
                            // The clear is a side effect, not just a test, so it must not
                            // become a match guard.
                            let cleared = state
                                .data
                                .users
                                .clear_csam_upload_sanction_if_for_report(user_id, m.csam_report_index);
                            if cleared && !moderation::has_other_active_sanction(*user_id, attempt_report_index, now, state) {
                                moderation::unsuspend_sender(*user_id, attempt_report_index, now, state);
                            }
                        }
                        None => {}
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
                            authority_report: matches!(inherited, Some(ModerationVerdict::UpheldAsCsam))
                                .then_some(types::AuthorityReportState::Due { urgent: false }),
                            status: ReportedMessages::report_status(&attempt_report),
                            timestamp: now,
                        },
                        state,
                    );
                }
                None => {
                    // Unknown original report index (legacy denylist entry with no report):
                    // no report to anchor, but the attempt and sanction must still be visible
                    state.push_event_to_local_user_index(
                        *user_id,
                        build_upload_sanction_message_to_uploader(*user_id, verdict_pending),
                    );
                    let text = format!(
                        "🚨 Attempt to post blocked content\n\n\
                         {who} tried to {action} content {status_phrase} in report #{}. \
                         The attempt was blocked and no message was created. The user has been suspended indefinitely; \
                         if this sanction was applied in error, unsuspending the user reverses it.",
                        m.csam_report_index
                    );
                    moderation::post_moderation_notice(text, state);
                }
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
