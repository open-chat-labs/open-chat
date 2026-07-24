use crate::guards::caller_is_platform_moderator;
use crate::model::moderation;
use crate::model::reported_messages::{
    HumanVerdict, ModerationAction, RecordVerdictResult, build_restoration_message_to_sender,
    build_verdict_message_to_reporter, build_verdict_message_to_sender,
};
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{ModerationReportResolution, ModerationReportStatus, OCResult};
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
                // Suspension stays indefinite. The chat-canister copy is permanently removed;
                // the vault copy persists with the retention clock started, and an authority
                // report becomes due.
                moderation::hard_delete_message(
                    reported_message.chat_id,
                    reported_message.thread_root_message_index,
                    reported_message.message_id,
                    &mut state.data.fire_and_forget_handler,
                );
                moderation::apply_vault_verdict(&reported_message.blob_references, state);
                state
                    .data
                    .authority_reports
                    .push_due(args.report_index, args.urgent.unwrap_or_default(), now);
            } else {
                if !reported_message.already_deleted {
                    moderation::delete_message(
                        reported_message.chat_id,
                        reported_message.thread_root_message_index,
                        reported_message.message_id,
                        &mut state.data.fire_and_forget_handler,
                    );
                }
                moderation::suspend_sender(reported_message.sender, now, state);
                state
                    .data
                    .authority_reports
                    .push_due(args.report_index, args.urgent.unwrap_or_default(), now);
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
                moderation::unquarantine_blobs(&reported_message.blob_references, state);
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
                moderation::suspend_sender_for_upheld_violation(reported_message.sender, now, state);
            }
            state.push_event_to_local_user_index(reported_message.sender, build_verdict_message_to_sender(&reported_message));
        }
        ModerationVerdict::Dismissed => {
            if was_auto_sanctioned {
                // A false positive: reverse the sanction in full - unsuspend, restore the
                // message, release the vault, clear the flags. (If an authority report was
                // already filed for this case - contested hash match or valve filing - a
                // supplementary portal correction is a discretionary manual step.)
                moderation::unsuspend_sender(reported_message.sender, now, state);
                moderation::undelete_message(
                    reported_message.chat_id,
                    reported_message.thread_root_message_index,
                    reported_message.message_id,
                    &mut state.data.fire_and_forget_handler,
                );
                moderation::unquarantine_blobs(&reported_message.blob_references, state);
                state.push_event_to_local_user_index(
                    reported_message.sender,
                    build_restoration_message_to_sender(&reported_message),
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
