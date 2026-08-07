use crate::guards::caller_is_platform_operator;
use crate::model::moderation;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use user_index_canister::set_vault_legal_hold::*;

// A preservation request (typically from law enforcement) must outlast the ordinary retention
// period: a hold stops the retention clock deleting the evidence, and any release requested
// while it is set is deferred until it is cleared. Operator-only, and recorded in the internal
// moderation channel so the reason for the hold is on the record alongside the evidence.
#[update(guard = "caller_is_platform_operator", msgpack = true)]
#[trace]
fn set_vault_legal_hold(args: Args) -> Response {
    mutate_state(|state| set_vault_legal_hold_impl(args, state)).into()
}

fn set_vault_legal_hold_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let report = state
        .data
        .reported_messages
        .get(args.report_index)
        .ok_or(OCErrorCode::MessageNotFound)?;

    // Clearing a hold on evidence whose release is already pending PERFORMS that release, so
    // this one case destroys evidence just as surely as destroy_vault_evidence does, and goes
    // through the same dual authorization (#9136). Ordinary holds stay single-actor: they are
    // reversible and destroy nothing.
    if !args.legal_hold && report.release_pending {
        return Err(OCErrorCode::InvalidRequest.with_message(
            "Clearing this hold would immediately release the evidence - propose it as a protected action instead",
        ));
    }

    execute(args, state)
}

pub(crate) fn execute(args: Args, state: &mut RuntimeState) -> OCResult {
    let caller = state.env.caller();
    let operator = state
        .data
        .users
        .get_by_principal(&caller)
        .map(|u| u.user_id)
        .ok_or(OCErrorCode::InitiatorNotFound)?;

    if args.reference.trim().is_empty() {
        return Err(OCErrorCode::InvalidRequest.with_message("A reference for the request is required"));
    }

    let report = state
        .data
        .reported_messages
        .get(args.report_index)
        .cloned()
        .ok_or(OCErrorCode::MessageNotFound)?;

    if report.blob_references.is_empty() {
        return Err(OCErrorCode::InvalidRequest.with_message("The report holds no vaulted evidence"));
    }

    moderation::set_vault_legal_hold(&report.blob_references, args.legal_hold, state);
    state
        .data
        .reported_messages
        .set_legal_hold(args.report_index, args.legal_hold);

    let action = if args.legal_hold { "set" } else { "cleared" };
    let released = if !args.legal_hold && report.release_pending {
        " — the deferred release of the evidence has now been performed"
    } else {
        ""
    };
    moderation::notify_other_platform_operators(
        format!(
            "🔒 Legal hold {action} on the evidence for report #{}{released}\n\nBy @UserId({operator}), under reference: {}",
            args.report_index, args.reference
        ),
        state,
    );

    Ok(())
}
