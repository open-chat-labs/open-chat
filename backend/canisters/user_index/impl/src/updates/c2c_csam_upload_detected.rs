use crate::guards::caller_is_storage_index;
use crate::model::moderation;
use crate::model::reported_messages::{AddBlockedAttemptResult, ReportedMessages, build_upload_sanction_message_to_uploader};
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use tracing::warn;
use types::UserId;
use user_index_canister::c2c_csam_upload_detected::*;
use user_index_canister::resolve_moderation_report::ModerationVerdict;

// A storage bucket refused an attempt to upload or forward content whose hash matches either
// a previous UpheldAsCsam verdict or a blob quarantined awaiting its verdict. No message
// exists (the attempt was blocked at the bucket).
//
// Sanctioning follows the anchor report's provenance and state, never the transport's
// snapshot (I9, I13):
// - Pre-verdict attempts sanction ONLY when the anchor report is machine-detected
//   (DetectionSource::Proactive). A pin created by an unverified reporter assertion
//   deliberately does not suspend the reported sender, so it must not suspend third parties
//   either - those attempts are blocked and surfaced as a notice, nothing more.
// - The consequences derive from the attempt report's verdict state at processing time: the
//   c2c hop is async and the original can resolve in flight.
//
// Deliberately NOT handled here: existing pre-verdict copies of the content. Every reported
// copy gets its own human verdict, and the denylist only gates FUTURE uploads - a verdict on
// one report is never applied retrospectively to messages already under review.
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
            "Attempt to post blocked content"
        );

        let action = match m.kind {
            CsamMatchKind::UploadAttempt => "upload",
            CsamMatchKind::ForwardAttempt => "forward",
            CsamMatchKind::PendingQuarantineAttempt => "re-post",
            // The inert default for events which predate the kind field: treat conservatively
            // (no way to know it was a knowing post-verdict act, so no sanction)
            CsamMatchKind::ExistingCopy => continue,
        };

        let Some((user_id, username)) = uploader else {
            // No resolvable user means no sanction and no report to anchor: fall back to a
            // plain notice so the attempt is at least visible to the moderators
            let text = format!(
                "🚨 Attempt to post blocked content\n\n\
                 An unrecognised principal ({}) tried to {action} content blocked under report #{}. \
                 The attempt was refused and no message was created. \
                 The user could not be resolved, so NO suspension was applied.",
                m.uploader, m.csam_report_index
            );
            moderation::post_throttled_blocked_attempt_notice(m.csam_report_index, text, now, state);
            continue;
        };
        let who = format!("@{username} ({user_id})");

        // Provenance gate (I13): a pre-verdict pin whose anchor report is not machine-backed
        // came from an unverified reporter assertion. That assertion deliberately does not
        // suspend the reported sender, so it must not suspend third parties either - otherwise
        // any account could grind arbitrary uploaders of a common image offline by asserting
        // CSAM against one copy of it.
        // Machine-backed = the automated pipeline actually applied a suspension
        // (suspension_applied_without_verdict), NOT the detection source: a machine detection
        // collapsing into an existing user report fills the outcome but leaves the detection
        // as UserReport, and must still count.
        if matches!(m.kind, CsamMatchKind::PendingQuarantineAttempt) {
            let machine_detected = state
                .data
                .reported_messages
                .get(m.csam_report_index)
                .is_some_and(|o| o.suspension_applied_without_verdict());
            if !machine_detected {
                let text = format!(
                    "🚨 Blocked re-post of content under review\n\n\
                     {who} tried to {action} content quarantined pending review of a user report (report #{}). \
                     The attempt was blocked and no message was created. No sanction was applied: an unverified \
                     reporter assertion does not suspend the reported sender, so it must not suspend third \
                     parties either. If the report is upheld the content is denylisted and future attempts are \
                     sanctioned and reported.",
                    m.csam_report_index
                );
                moderation::post_throttled_blocked_attempt_notice(m.csam_report_index, text, now, state);
                continue;
            }
        }

        // Each blocked attempt is a fresh offence and owes its own authority (NCA) report, so
        // it gets its own first-class report anchored to the original report's evidence.
        // Guards in add_blocked_attempt_report keep that honest: attempts within the
        // client-retry window, or beyond the per-offender report cap, tally onto the latest
        // report (still available to the authority filing) and surface as a notice instead.
        match state
            .data
            .reported_messages
            .add_blocked_attempt_report(m.csam_report_index, user_id, now)
        {
            Some(AddBlockedAttemptResult::New {
                attempt_report_index,
                report: attempt_report,
            }) => {
                // The report is registered on the attempter like any other, so the sanction
                // helpers (strike counts, other-active-sanction checks, contest) can see it
                state.data.users.push_reported_message(user_id, attempt_report_index);

                let inherited = attempt_report.human_verdict().map(|v| v.verdict);
                apply_attempt_sanction(user_id, m.csam_report_index, attempt_report_index, inherited, now, state);
                if !matches!(inherited, Some(ModerationVerdict::Dismissed)) {
                    state.push_event_to_local_user_index(
                        user_id,
                        build_upload_sanction_message_to_uploader(user_id, inherited.is_none()),
                    );
                }
                if matches!(inherited, Some(ModerationVerdict::UpheldAsCsam)) {
                    // Adjudicated content: the attempt's authority report is due immediately
                    // (hash-only filing - the NCA matches the hash server-side, nobody
                    // re-views the content)
                    state.data.authority_reports.push_due(attempt_report_index, false, now);
                }
                moderation::post_moderation_alert(
                    moderation::ModerationAlert {
                        report_index: Some(attempt_report_index),
                        chat_id: attempt_report.chat_id,
                        thread_root_message_index: attempt_report.thread_root_message_index,
                        message_index: attempt_report.message_index,
                        message_id: attempt_report.message_id,
                        sender: user_id,
                        reporters: Vec::new(),
                        categories: types::ModerationCategories::SEXUAL_MINORS,
                        classification_failed: false,
                        auto_sanctioned: !matches!(inherited, Some(ModerationVerdict::Dismissed)),
                        content_excerpt: Some(format!(
                            "[blocked attempt to {action} content {} in report #{}]",
                            anchor_state_phrase(inherited),
                            m.csam_report_index
                        )),
                        blob_references: attempt_report.blob_references.clone(),
                        media_matches: attempt_report.media_matches.clone(),
                        authority_report: matches!(inherited, Some(ModerationVerdict::UpheldAsCsam))
                            .then_some(types::AuthorityReportState::Due { urgent: false }),
                        is_blocked_attempt: true,
                        status: ReportedMessages::report_status(&attempt_report),
                        timestamp: now,
                    },
                    state,
                );
            }
            Some(AddBlockedAttemptResult::Repeat {
                attempt_report_index,
                total_attempts,
            }) => {
                // State-derived like the New arm (I9): the tallied attempt report may have
                // been resolved by mirroring since it was created, and a repeat must never
                // resurrect a sanction its resolution reversed
                let verdict = state
                    .data
                    .reported_messages
                    .get(attempt_report_index)
                    .and_then(|r| r.human_verdict().map(|v| v.verdict));
                apply_attempt_sanction(user_id, m.csam_report_index, attempt_report_index, verdict, now, state);
                // No fresh message to the uploader: their sanction state is unchanged since
                // the first attempt informed them, and a per-attempt DM would let a scripted
                // uploader generate unbounded bot messages
                let text = format!(
                    "🚨 Repeat attempt to {action} content {} in report #{} \
                     ({who}, attempt {total_attempts}; recorded on attempt report #{attempt_report_index}). \
                     The attempt was blocked and no message was created.",
                    anchor_state_phrase(verdict),
                    m.csam_report_index
                );
                moderation::post_throttled_blocked_attempt_notice(attempt_report_index, text, now, state);
            }
            None => {
                // Unknown original report index (legacy denylist entry with no report): only
                // reachable for post-verdict kinds, where the sanction stands on the verdict
                moderation::suspend_sender(user_id, now, state);
                state
                    .data
                    .users
                    .record_csam_upload_sanction(user_id, m.csam_report_index, now);
                state.push_event_to_local_user_index(user_id, build_upload_sanction_message_to_uploader(user_id, false));
                let text = format!(
                    "🚨 Attempt to post blocked content\n\n\
                     {who} tried to {action} content upheld as CSAM in report #{}. \
                     The attempt was blocked and no message was created. The user has been suspended indefinitely; \
                     if this sanction was applied in error, unsuspending the user reverses it.",
                    m.csam_report_index
                );
                moderation::post_throttled_blocked_attempt_notice(m.csam_report_index, text, now, state);
            }
        }
    }
}

// The sanction consequences appropriate to the anchor's adjudication state at processing
// time (I9). `None` = still pending review.
fn apply_attempt_sanction(
    user_id: UserId,
    original_report_index: u64,
    attempt_report_index: u64,
    verdict: Option<ModerationVerdict>,
    now: types::TimestampMillis,
    state: &mut RuntimeState,
) {
    match verdict {
        None | Some(ModerationVerdict::UpheldAsCsam) => {
            // Pending: the provisional sanction, tied to the original report so its
            // resolution governs it (I3). Confirmed: the same sanction, now verdict-backed.
            moderation::suspend_sender(user_id, now, state);
            state
                .data
                .users
                .record_csam_upload_sanction(user_id, original_report_index, now);
        }
        Some(ModerationVerdict::Upheld) => {
            // A violation but not CSAM: the standard severity, like the original sender's.
            // No hash-match sanction record - it would wrongly read as an indefinite
            // sanction to every other-sanction check.
            moderation::suspend_sender(user_id, now, state);
            moderation::downgrade_suspension_to_upheld_violation(user_id, attempt_report_index, now, state);
        }
        Some(ModerationVerdict::Dismissed) => {
            // The content was cleared: no sanction, and any stale record from an earlier
            // attempt against this report lifts. The clear is unconditional; the unsuspend
            // decision rests on the other-sanction check alone (I1/I2 - the record may
            // already have been cleared or overwritten, and that must not strand the user).
            state
                .data
                .users
                .clear_csam_upload_sanction_if_for_report(&user_id, original_report_index);
            if !moderation::has_other_active_sanction(user_id, attempt_report_index, now, state) {
                moderation::unsuspend_sender(user_id, attempt_report_index, now, state);
            }
        }
    }
}

fn anchor_state_phrase(verdict: Option<ModerationVerdict>) -> &'static str {
    match verdict {
        None => "quarantined pending review",
        Some(ModerationVerdict::UpheldAsCsam) => "upheld as CSAM",
        Some(ModerationVerdict::Upheld) => "upheld as a rules violation",
        Some(ModerationVerdict::Dismissed) => "formerly quarantined (cleared on review)",
    }
}
