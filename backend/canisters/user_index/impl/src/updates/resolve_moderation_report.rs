use crate::guards::caller_is_platform_moderator;
use crate::model::moderation;
use crate::model::reported_messages::{
    HumanVerdict, RecordVerdictResult, build_verdict_message_to_reporter, build_verdict_message_to_sender,
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
            return Err(OCErrorCode::InvalidRequest.with_message("Report was not escalated for human review"));
        }
    };

    match args.verdict {
        ModerationVerdict::Upheld | ModerationVerdict::UpheldAsCsam => {
            if !reported_message.already_deleted {
                moderation::delete_message(
                    reported_message.chat_id,
                    reported_message.thread_root_message_index,
                    reported_message.message_id,
                    &mut state.data.fire_and_forget_handler,
                );
            }

            if matches!(args.verdict, ModerationVerdict::UpheldAsCsam) {
                moderation::suspend_sender(reported_message.sender, now, state);
            } else {
                moderation::suspend_sender_for_upheld_violation(reported_message.sender, now, state);
            }

            // Inform the sender that their message has violated the platform rules
            state.push_event_to_local_user_index(reported_message.sender, build_verdict_message_to_sender(&reported_message));
        }
        ModerationVerdict::Dismissed => {
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
