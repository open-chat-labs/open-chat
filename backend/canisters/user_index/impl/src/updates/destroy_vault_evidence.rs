use crate::guards::caller_is_platform_operator;
use crate::model::moderation;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use user_index_canister::destroy_vault_evidence::*;

// Destruction on a law enforcement request (18 U.S.C. 2258B(c)(2)): the only operation which
// overrides both the retention clock and a legal hold. Irreversible - the blobs are removed
// even if a restored or re-posted message still references them - so it is operator-only,
// requires the request reference, and leaves that reference in the vault log and the internal
// moderation channel.
#[update(guard = "caller_is_platform_operator", msgpack = true)]
#[trace]
fn destroy_vault_evidence(args: Args) -> Response {
    mutate_state(|state| destroy_vault_evidence_impl(args, state)).into()
}

fn destroy_vault_evidence_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let caller = state.env.caller();
    let operator = state
        .data
        .users
        .get_by_principal(&caller)
        .map(|u| u.user_id)
        .ok_or(OCErrorCode::InitiatorNotFound)?;

    if args.le_request_ref.trim().is_empty() {
        return Err(OCErrorCode::InvalidRequest.with_message("A law enforcement request reference is required"));
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

    moderation::destroy_vault_evidence(&report.blob_references, args.le_request_ref.clone(), state);

    moderation::post_moderation_notice(
        format!(
            "🗑️ Vaulted evidence for report #{} destroyed on law enforcement request\n\nBy {operator}, under reference: {}",
            args.report_index, args.le_request_ref
        ),
        state,
    );

    Ok(())
}
