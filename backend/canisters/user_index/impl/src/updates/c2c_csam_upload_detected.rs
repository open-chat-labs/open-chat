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
            moderation::post_throttled_blocked_attempt_notice(m.csam_report_index, m.uploader, text, now, state);
            continue;
        };
        let who = format!("@{username} ({user_id})");

        // Provenance gate (I13): a pre-verdict pin whose anchor report is not machine-backed
        // came from an unverified reporter assertion. That assertion deliberately does not
        // suspend the reported sender, so it must not suspend third parties either - otherwise
        // any account could grind arbitrary uploaders of a common image offline by asserting
        // CSAM against one copy of it.
        // Machine-backed = the automated pipeline actually applied a suspension. That is the
        // `sanctioned` flag on the automated outcome ALONE: it is recorded once at detection
        // time and never cleared, i.e. true provenance. Neither the detection source (a
        // machine detection collapsing into a user report leaves it UserReport) nor the
        // verdict's presence (the anchor can resolve while this event is in flight - I9) may
        // enter the predicate.
        if matches!(m.kind, CsamMatchKind::PendingQuarantineAttempt) {
            let machine_detected = state
                .data
                .reported_messages
                .get(m.csam_report_index)
                .is_some_and(|o| o.machine_sanction_applied());
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
                moderation::post_throttled_blocked_attempt_notice(m.csam_report_index, m.uploader, text, now, state);
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
                let sanction_applied =
                    apply_attempt_sanction(user_id, m.csam_report_index, attempt_report_index, inherited, now, state);
                if sanction_applied {
                    state
                        .push_event_to_local_user_index(user_id, build_upload_sanction_message_to_uploader(user_id, inherited));
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
                        auto_sanctioned: sanction_applied,
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
                let _ = apply_attempt_sanction(user_id, m.csam_report_index, attempt_report_index, verdict, now, state);
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
                moderation::post_throttled_blocked_attempt_notice(attempt_report_index, m.uploader, text, now, state);
            }
            None => {
                // Unknown original report index (legacy denylist entry with no report): only
                // reachable for post-verdict kinds, where the sanction stands on the verdict.
                // The primitive refuses to replace a manual suspension (I1a), and the DM and
                // notice track what actually happened (I5/I21).
                let applied = moderation::suspend_sender(user_id, None, now, state);
                state
                    .data
                    .users
                    .record_csam_upload_sanction(user_id, m.csam_report_index, now);
                if applied {
                    state.push_event_to_local_user_index(
                        user_id,
                        build_upload_sanction_message_to_uploader(user_id, Some(ModerationVerdict::UpheldAsCsam)),
                    );
                }
                let suspension_text = if applied {
                    "The user has been suspended indefinitely; if this sanction was applied in error, unsuspending the user reverses it."
                } else {
                    "The user already carries a suspension which was left in place."
                };
                let text = format!(
                    "🚨 Attempt to post blocked content\n\n\
                     {who} tried to {action} content upheld as CSAM in report #{}. \
                     The attempt was blocked and no message was created. {suspension_text}",
                    m.csam_report_index
                );
                moderation::post_throttled_blocked_attempt_notice(m.csam_report_index, m.uploader, text, now, state);
            }
        }
    }
}

// The sanction consequences appropriate to the anchor's adjudication state at processing
// time (I9). `None` = still pending review. Returns true when a sanction was actually
// applied by this flow - the caller's uploader DM and card must reflect reality (I5/I21).
fn apply_attempt_sanction(
    user_id: UserId,
    original_report_index: u64,
    attempt_report_index: u64,
    verdict: Option<ModerationVerdict>,
    now: types::TimestampMillis,
    state: &mut RuntimeState,
) -> bool {
    match verdict {
        None | Some(ModerationVerdict::UpheldAsCsam) => {
            // Pending: the provisional sanction, tied to the original report so its
            // resolution governs it (I3) and worded as SUSPECTED (I21). Confirmed: the same
            // sanction, verdict-backed and worded as confirmed. The primitive refuses to
            // replace a manual moderator suspension (I1a) and returns whether it applied -
            // which is what the caller's messaging and card must reflect (I5/I21). The
            // record still links the sanction so the report's resolution can settle it.
            let applied = if verdict.is_none() {
                // Detection-caused: evaporates if the attempt report is resolved (via the
                // verdict mirror) before this commits (I1b)
                moderation::suspend_attempter_pending_review(user_id, attempt_report_index, now, state)
            } else {
                // Verdict-backed (the anchor is already upheld): survives resolution
                moderation::suspend_sender(user_id, None, now, state)
            };
            state
                .data
                .users
                .record_csam_upload_sanction(user_id, original_report_index, now);
            applied
        }
        Some(ModerationVerdict::Upheld) => {
            // A violation but not CSAM: the standard severity, like the original sender's.
            // The downgrade enqueues its own (one-day) suspension - a preceding
            // suspend_sender would race it with an indefinite, CSAM-worded one (I21) and
            // whichever write landed last would win. No hash-match sanction record either -
            // it would wrongly read as an indefinite sanction to every other-sanction check.
            // The primitive refuses to downgrade a manual suspension (I1a).
            moderation::downgrade_suspension_to_upheld_violation(user_id, attempt_report_index, now, state)
        }
        Some(ModerationVerdict::Dismissed) => {
            // The content was cleared: no sanction is applied, and a stale record from an
            // EARLIER attempt against this report lifts. Unlike the resolve-time mirror, the
            // unsuspend here requires the clear to have actually removed such a record: this
            // path applied no suspension of its own, so without one to reverse it must not
            // touch the user's suspension state at all - has_other_active_sanction cannot
            // see manual moderator suspensions (I1/I2). Overwritten-record cases are the
            // mirror's job at resolution time, not this arm's.
            let cleared = state
                .data
                .users
                .clear_csam_upload_sanction_if_for_report(&user_id, original_report_index);
            if cleared && !moderation::has_other_active_sanction(user_id, attempt_report_index, now, state) {
                // The primitive refuses to lift a manual suspension (I1a)
                let _ = moderation::unsuspend_sender(user_id, attempt_report_index, now, state);
            }
            false
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
