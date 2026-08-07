use crate::RuntimeState;
use crate::model::moderation;
use oc_error_codes::OCErrorCode;
use types::{OCResult, UserId};
use user_index_canister::destroy_vault_evidence::Args;

// Destruction on a law enforcement request (18 U.S.C. 2258B(c)(2)). Irreversible - the blobs
// are removed even if a restored or re-posted message still references them - so it is behind
// dual authorization: reachable only via propose_protected_action + confirm_protected_action
// by two different platform operators (#9136). Requires the request reference, and leaves that
// reference - and both operator identities - in the vault log and the internal moderation
// channel. The bucket refuses destruction while a legal hold stands; clearing the hold is a
// separate, separately-logged act.
pub(crate) fn execute(args: Args, proposed_by: UserId, confirmed_by: UserId, state: &mut RuntimeState) -> OCResult {
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

    // The bucket refuses destruction while a hold stands, so refuse here too rather than
    // reporting a destruction which will not happen. Clearing the hold is the separate,
    // separately logged act which must come first.
    if report.legal_hold {
        return Err(OCErrorCode::InvalidRequest
            .with_message("A legal hold stands on this evidence - clear the hold before destroying it"));
    }

    moderation::destroy_vault_evidence(
        &report.blob_references,
        args.le_request_ref.clone(),
        proposed_by,
        confirmed_by,
        state,
    );

    // No notice here: this is only ever reached through a confirmed protected action, whose
    // own alert already names the report, the reference and both operators

    Ok(())
}
