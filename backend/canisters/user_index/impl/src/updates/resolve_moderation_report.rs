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
                moderation::hard_delete_message(
                    reported_message.chat_id,
                    reported_message.thread_root_message_index,
                    reported_message.message_id,
                    &mut state.data.fire_and_forget_handler,
                );
                moderation::apply_vault_verdict(&reported_message.blob_references, moderator, args.report_index, state);
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
                if !reported_message.already_deleted {
                    moderation::delete_message(
                        reported_message.chat_id,
                        reported_message.thread_root_message_index,
                        reported_message.message_id,
                        &mut state.data.fire_and_forget_handler,
                    );
                }
                moderation::set_message_moderation_flags(
                    reported_message.chat_id,
                    reported_message.thread_root_message_index,
                    reported_message.message_id,
                    ModerationCategories::SEXUAL_MINORS.bits(),
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
                moderation::downgrade_suspension_to_upheld_violation(reported_message.sender, now, state);
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
            let mut unsuspended = false;
            if applied_suspension
                && !moderation::has_other_active_sanction(reported_message.sender, args.report_index, now, state)
            {
                moderation::unsuspend_sender(reported_message.sender, now, state);
                unsuspended = true;
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
                state.push_event_to_local_user_index(
                    reported_message.sender,
                    build_restoration_message_to_sender(&reported_message, unsuspended),
                );
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

    Ok(())
}
