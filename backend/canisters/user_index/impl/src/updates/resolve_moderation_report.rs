use crate::guards::caller_is_platform_moderator;
use crate::model::moderation;
use crate::model::reported_messages::{
    HumanVerdict, ModerationAction, RecordVerdictResult, ReportOutcome, build_restoration_message_to_sender,
    build_verdict_message_to_reporter, build_verdict_message_to_sender,
};
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{ModerationCategories, ModerationReportResolution, ModerationReportStatus, OCResult};
use user_index_canister::resolve_moderation_report::*;

#[update(guard = "caller_is_platform_moderator", msgpack = true)]
#[trace]
fn resolve_moderation_report(args: Args) -> Response {
    mutate_state(|state| resolve_moderation_report_impl(args, state)).into()
}

fn resolve_moderation_report_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let caller = state.env.caller();
    let now = state.env.now();

    let moderator = state
        .data
        .users
        .get_by_principal(&caller)
        .map(|u| u.user_id)
        .ok_or(OCErrorCode::InitiatorNotFound)?;

    // A moderator must never rule on a case they are party to. On their own message that
    // covers every verdict: dismissal would self-unsuspend, restore the content and release
    // the vault, and upholding a report against yourself is not a workflow.
    //
    // On their own CSAM assertion the ONLY verdict left open is UpheldAsCsam - the
    // maximum-scrutiny path (evidence retained in the vault, authority report due), so nothing
    // can be buried by taking it, and barring it deadlocked a reviewer who is the only one
    // available: obliged to act on what they found but unable to close the case or file the
    // authority report (which the UI only offers after an uphold).
    //
    // Dismissed is barred because dismissal is the judgment which records a false report
    // against the asserter, and that judgment must be independent. Plain Upheld is barred
    // because it is the burial path: it closes the case forever (so the Dismissed branch - the
    // only place a false report is ever recorded - becomes unreachable), releases the vaulted
    // evidence, and skips every escalation, while still punishing the sender.
    if let Some(report) = state.data.reported_messages.get(args.report_index) {
        // A blocked-attempt report is never resolved directly: a pre-verdict attempt resolves
        // by mirroring its original report's verdict, and for a post-verdict attempt the only
        // reviewable question is attribution, which is the contest/unsuspend path. Resolving
        // one here would also fire the message-restoration side effects at the ORIGINAL
        // message coordinates the attempt report borrows.
        if matches!(
            report.detection,
            crate::model::reported_messages::DetectionSource::BlockedAttempt { .. }
        ) {
            return Err(OCErrorCode::InvalidRequest.with_message(
                "Blocked-attempt reports resolve with their original report; use unsuspend to reverse the sanction",
            ));
        }
        if report.sender == moderator {
            return Err(OCErrorCode::InitiatorNotAuthorized.with_message("Cannot resolve a report against your own message"));
        }
        if !matches!(args.verdict, ModerationVerdict::UpheldAsCsam) && report.csam_asserted_by.contains(&moderator) {
            return Err(OCErrorCode::InitiatorNotAuthorized.with_message(
                "Cannot resolve your own CSAM assertion, except by upholding it as CSAM - another moderator must review it",
            ));
        }
    }

    let reported_message = match state.data.reported_messages.record_human_verdict(
        args.report_index,
        HumanVerdict {
            verdict: args.verdict,
            moderator,
            timestamp: now,
        },
    ) {
        RecordVerdictResult::Success(m) => m,
        RecordVerdictResult::ReportNotFound => return Err(OCErrorCode::MessageNotFound.into()),
        RecordVerdictResult::AlreadyResolved => return Err(OCErrorCode::NoChange.with_message("Already resolved")),
        RecordVerdictResult::NotEscalated => {
            return Err(OCErrorCode::InvalidRequest.with_message("Report cannot be resolved with a verdict"));
        }
    };

    // Reports which were auto-sanctioned had the sanction (deletion + indefinite suspension +
    // quarantine) applied at detection time; the verdict confirms or reverses it. Escalated
    // reports had no sanction applied, so an upholding verdict applies one now.
    let was_auto_sanctioned = matches!(reported_message.automated_action(), Some(ModerationAction::AutoSanctioned));

    match args.verdict {
        ModerationVerdict::UpheldAsCsam => {
            if was_auto_sanctioned {
                // The suspension becomes (or stays) indefinite: reporter-asserted sanctions
                // deliberately defer suspension to this verdict, and for classifier detections
                // the call is a no-op since the sender is already indefinitely suspended. The
                // chat-canister copy is permanently removed; the vault copy persists with the
                // retention clock started, and an authority report becomes due.
                moderation::suspend_sender(reported_message.sender, now, state);
                // Quarantine is re-sent with the verdict in a single ordered message: the
                // detection-time quarantine is fire-and-forget, and a verdict which arrives
                // at a bucket holding no record is dropped, leaving confirmed CSAM served
                // with no retention clock. Quarantine is idempotent, so re-sending is free.
                // Sent BEFORE the hard delete, which releases the message's file references:
                // if the original quarantine was lost, releasing them first could destroy the
                // evidence this verdict is meant to preserve.
                moderation::quarantine_blobs_and_apply_verdict(
                    args.report_index,
                    &reported_message,
                    ModerationCategories::SEXUAL_MINORS.bits(),
                    moderator,
                    state,
                );
                moderation::hard_delete_message(
                    reported_message.chat_id,
                    reported_message.thread_root_message_index,
                    reported_message.message_id,
                    &mut state.data.fire_and_forget_handler,
                );
                state
                    .data
                    .authority_reports
                    .push_due(args.report_index, args.urgent.unwrap_or_default(), now);
                moderation::update_moderation_alert_authority_report(
                    &reported_message,
                    types::AuthorityReportState::Due {
                        urgent: args.urgent.unwrap_or_default(),
                    },
                    state,
                );
            } else {
                // An escalated report upheld as CSAM: the sanction applies now. Quarantine
                // before anything else so the media is pinned, soft-delete the message, and
                // set the CSAM flag - which locks the deleted content behind the quarantine
                // read-gate for everyone. (No hard delete here: unlike the auto-sanctioned
                // path the vault pins are not yet held, so releasing file references could
                // destroy the blob before the quarantine op lands.)
                moderation::quarantine_blobs_and_apply_verdict(
                    args.report_index,
                    &reported_message,
                    ModerationCategories::SEXUAL_MINORS.bits(),
                    moderator,
                    state,
                );
                moderation::delete_and_flag_message(
                    reported_message.chat_id,
                    reported_message.thread_root_message_index,
                    reported_message.message_id,
                    ModerationCategories::SEXUAL_MINORS.bits(),
                    reported_message.already_deleted,
                    &mut state.data.fire_and_forget_handler,
                );
                moderation::suspend_sender(reported_message.sender, now, state);
                state
                    .data
                    .authority_reports
                    .push_due(args.report_index, args.urgent.unwrap_or_default(), now);
                moderation::update_moderation_alert_authority_report(
                    &reported_message,
                    types::AuthorityReportState::Due {
                        urgent: args.urgent.unwrap_or_default(),
                    },
                    state,
                );
            }
            state.push_event_to_local_user_index(reported_message.sender, build_verdict_message_to_sender(&reported_message));
        }
        ModerationVerdict::Upheld => {
            if was_auto_sanctioned {
                // A rules violation but not CSAM: the indefinite CSAM suspension is downgraded
                // to the standard severity, the chat copy is removed, and the vault releases
                // the media (no preservation duty applies to non-CSAM content)
                moderation::hard_delete_message(
                    reported_message.chat_id,
                    reported_message.thread_root_message_index,
                    reported_message.message_id,
                    &mut state.data.fire_and_forget_handler,
                );
                moderation::unquarantine_blobs(&reported_message.blob_references, moderator, args.report_index, state);
                moderation::downgrade_suspension_to_upheld_violation(reported_message.sender, args.report_index, now, state);
            } else {
                if !reported_message.already_deleted {
                    moderation::delete_message(
                        reported_message.chat_id,
                        reported_message.thread_root_message_index,
                        reported_message.message_id,
                        &mut state.data.fire_and_forget_handler,
                    );
                }
                // An escalated report can have been protectively quarantined by a CSAM
                // assertion; not-CSAM means no preservation duty, so release the vault claim
                // and clear the assertion's read-gate flag (the message stays deleted as an
                // ordinary violation)
                if !reported_message.csam_asserted_by.is_empty() {
                    moderation::unquarantine_blobs(&reported_message.blob_references, moderator, args.report_index, state);
                    moderation::set_message_moderation_flags(
                        reported_message.chat_id,
                        reported_message.thread_root_message_index,
                        reported_message.message_id,
                        0,
                        &mut state.data.fire_and_forget_handler,
                    );
                }
                moderation::suspend_sender_for_upheld_violation(reported_message.sender, now, state);
            }
            state.push_event_to_local_user_index(reported_message.sender, build_verdict_message_to_sender(&reported_message));
        }
        ModerationVerdict::Dismissed => {
            // A dismissed CSAM assertion was a false allegation with real consequences for the
            // sender: record it against exactly the reporters who made the assertion
            // (knowingly false reports are themselves a violation - this is the evidence base
            // for acting on repeat offenders)
            for reporter in &reported_message.csam_asserted_by {
                state.data.users.record_false_csam_report(*reporter);
            }
            // A protective takedown can also come from a CSAM assertion on an escalated
            // report (no auto-sanction, but the message was deleted and the media vaulted):
            // its dismissal must reverse exactly the same way
            let protection_applied = was_auto_sanctioned || !reported_message.csam_asserted_by.is_empty();
            // Only reverse a suspension this report actually APPLIED: a reporter-asserted
            // sanction never suspended, and blindly unsuspending could lift an unrelated
            // suspension (eg. one applied manually by a moderator for something else).
            // The unsuspend is also skipped if the sender has another report still keeping
            // them sanctioned: each report's dismissal only reverses its own contribution.
            let applied_suspension = matches!(&reported_message.outcome, Some(ReportOutcome::Automated(a)) if a.sanctioned);
            let unsuspended = applied_suspension
                && !moderation::has_other_active_sanction(reported_message.sender, args.report_index, now, state);
            if unsuspended {
                // The sender's statement of reasons is sent by the unsuspend job once the
                // unsuspension has actually landed, so it can never claim one that failed
                moderation::unsuspend_sender(reported_message.sender, args.report_index, now, state);
            }
            if protection_applied {
                // A false positive: reverse the takedown in full - restore the message,
                // release the vault, clear the flags. (If an authority report was already
                // filed for this case - contested hash match or valve filing - a
                // supplementary portal correction is a discretionary manual step.)
                // Restored unconditionally, including reports filed with delete: true - a
                // dismissal means the allegation was wrong, so the reporter's deletion is
                // reversed along with everything else (deliberate full-reversal semantics)
                moderation::undelete_message(
                    reported_message.chat_id,
                    reported_message.thread_root_message_index,
                    reported_message.message_id,
                    &mut state.data.fire_and_forget_handler,
                );
                moderation::unquarantine_blobs(&reported_message.blob_references, moderator, args.report_index, state);
                if !unsuspended {
                    // Nothing to wait for: no suspension is being lifted, so the restoration
                    // statement goes out now (the unsuspend job sends it in the other case)
                    state.push_event_to_local_user_index(
                        reported_message.sender,
                        build_restoration_message_to_sender(&reported_message, false),
                    );
                }
            }
            // Clear any moderation flags so the message is no longer hidden in the app store build
            moderation::set_message_moderation_flags(
                reported_message.chat_id,
                reported_message.thread_root_message_index,
                reported_message.message_id,
                0,
                &mut state.data.fire_and_forget_handler,
            );
        }
    }

    // Inform each reporter of the verdict
    for reporter in reported_message.reports.keys() {
        state.push_event_to_local_user_index(
            *reporter,
            build_verdict_message_to_reporter(&reported_message, args.verdict, *reporter),
        );
    }

    // Update the status shown on the alert message in the internal moderation channel
    let resolution = ModerationReportResolution {
        moderator,
        timestamp: now,
    };
    let status = match args.verdict {
        ModerationVerdict::Upheld => ModerationReportStatus::Upheld(resolution),
        ModerationVerdict::UpheldAsCsam => ModerationReportStatus::UpheldAsCsam(resolution),
        ModerationVerdict::Dismissed => ModerationReportStatus::Dismissed(resolution),
    };
    moderation::update_moderation_alert_status(&reported_message, status, state);

    // Blocked re-post attempts recorded against this report mirror its verdict (the attempt
    // reports were created by c2c_csam_upload_detected while this report was pending)
    let mirrored = state.data.reported_messages.mirror_verdict_to_attempt_reports(
        args.report_index,
        HumanVerdict {
            verdict: args.verdict,
            moderator,
            timestamp: now,
        },
    );
    for (attempt_index, attempt_report) in mirrored {
        match args.verdict {
            ModerationVerdict::UpheldAsCsam => {
                // The content is now confirmed CSAM: each blocked attempt is a fresh offence
                // owing its own authority report (hash-only filing)
                state
                    .data
                    .authority_reports
                    .push_due(attempt_index, args.urgent.unwrap_or_default(), now);
                moderation::update_moderation_alert_authority_report(
                    &attempt_report,
                    types::AuthorityReportState::Due {
                        urgent: args.urgent.unwrap_or_default(),
                    },
                    state,
                );
                state.push_event_to_local_user_index(attempt_report.sender, build_verdict_message_to_sender(&attempt_report));
            }
            ModerationVerdict::Upheld => {
                // A violation but not CSAM: the attempter's indefinite suspension downgrades
                // to the standard severity, mirroring the sender's treatment. The hash-match
                // sanction record is cleared FIRST - it belongs to the report being resolved,
                // and while present it short-circuits the indefinite-sanction check that
                // would otherwise block the downgrade
                state
                    .data
                    .users
                    .clear_csam_upload_sanction_if_for_report(&attempt_report.sender, args.report_index);
                moderation::downgrade_suspension_to_upheld_violation(attempt_report.sender, attempt_index, now, state);
                state.push_event_to_local_user_index(attempt_report.sender, build_verdict_message_to_sender(&attempt_report));
            }
            ModerationVerdict::Dismissed => {
                // The allegation was wrong, so the attempt sanction lifts with it. Clearing
                // the record (only when it points at THIS report) must happen before the
                // other-active-sanction check, which short-circuits on the record's presence;
                // anything else still sanctioning the attempter then keeps them suspended.
                if state
                    .data
                    .users
                    .clear_csam_upload_sanction_if_for_report(&attempt_report.sender, args.report_index)
                    && !moderation::has_other_active_sanction(attempt_report.sender, attempt_index, now, state)
                {
                    moderation::unsuspend_sender(attempt_report.sender, attempt_index, now, state);
                }
            }
        }
        moderation::update_moderation_alert_status(&attempt_report, status, state);
    }

    Ok(())
}
