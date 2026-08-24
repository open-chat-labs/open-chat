use crate::model::moderation;
use crate::{RuntimeState, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{CLAIM_TYPE_NCA_VAULT_EXPORT, NcaVaultExportClaims, OCResult};
use user_index_canister::record_authority_report_filed::*;

#[update(guard = "caller_is_platform_operator_or_authority_reporter", msgpack = true)]
#[trace]
fn record_authority_report_filed(args: Args) -> Response {
    mutate_state(|state| record_authority_report_filed_impl(args, state)).into()
}

fn caller_is_platform_operator_or_authority_reporter() -> Result<(), String> {
    read_state(|state| {
        if state.is_caller_platform_operator() || state.is_caller_authority_reporter() {
            Ok(())
        } else {
            Err("Caller is not a platform operator or the authority reporter".to_string())
        }
    })
}

fn record_authority_report_filed_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let now = state.env.now();
    let caller = state.data.users.get_by_principal(&state.env.caller()).map(|u| u.user_id);

    // The service path: the automated filing must present the vault token whose nonce matches
    // the open attempt marker - a filing can only be recorded by the window that performed it
    let mut ooh_call_acknowledged = false;
    if !state.is_caller_platform_operator() {
        let Some(token) = args.vault_token.as_ref() else {
            return Err(OCErrorCode::InitiatorNotAuthorized.with_message("A vault token is required"));
        };
        let claims = jwt::verify_and_decode::<NcaVaultExportClaims>(
            token,
            state.data.oc_key_pair.public_key_pem(),
            CLAIM_TYPE_NCA_VAULT_EXPORT,
        )
        .map_err(|_| OCErrorCode::InitiatorNotAuthorized.with_message("Invalid vault token"))?;
        // No expiry check, deliberately: the NCA POST can outlive the 5-minute window, and a
        // report which WAS filed must always be recordable - the nonce match is the guard
        let claims = claims.into_custom();
        if claims.report_index != args.report_index {
            return Err(OCErrorCode::InitiatorNotAuthorized.with_message("Token is for a different report"));
        }
        let Some(attempt) = state.data.authority_reports.attempt(args.report_index) else {
            return Err(OCErrorCode::InvalidRequest.with_message("No filing attempt is marked in flight"));
        };
        if attempt.nonce != claims.nonce {
            return Err(OCErrorCode::InitiatorNotAuthorized.with_message("Token does not match the open attempt"));
        }
        if args.unverified {
            // D11: the automated path never files unverified reports, so it cannot record one
            return Err(OCErrorCode::InvalidRequest.with_message("The automated path only files verified reports"));
        }
        ooh_call_acknowledged = claims.ooh_call_acknowledged;
    }

    let Some(report) = state.data.reported_messages.get(args.report_index) else {
        return Err(OCErrorCode::MessageNotFound.into());
    };

    // Never for a report against your own message: marking the filing done satisfies the due
    // queue and flips the alert card to Filed, so the subject of the report could suppress the
    // statutory authority report about themselves with a reference nobody else ever checks
    if caller.is_some_and(|c| c == report.sender) {
        return Err(OCErrorCode::InitiatorNotAuthorized
            .with_message("Cannot record the authority report filing for a report against your own message"));
    }
    // The urgency-valve (unverified) filing leaves the verdict open for a reviewer to
    // resolve - which is impossible on an attempt report (I8), so the valve must anchor the
    // ORIGINAL report
    if args.unverified
        && matches!(
            report.detection,
            crate::model::reported_messages::DetectionSource::BlockedAttempt { .. }
        )
    {
        return Err(OCErrorCode::InvalidRequest
            .with_message("An unverified filing anchors the original report, not a blocked-attempt report"));
    }
    // An attempt row's filing equally concerns the ORIGINAL report's sender: the subject of
    // the underlying content must not record it either (I8)
    if let crate::model::reported_messages::DetectionSource::BlockedAttempt { original_report_index } = report.detection
        && state
            .data
            .reported_messages
            .get(original_report_index)
            .is_some_and(|original| caller.is_some_and(|c| c == original.sender))
    {
        return Err(OCErrorCode::InitiatorNotAuthorized
            .with_message("Cannot record the authority report filing for an attempt on your own reported content"));
    }

    state.data.authority_reports.record_filed(
        args.report_index,
        args.portal_reference.clone(),
        args.portal_reference_uuid.clone(),
        args.urgent,
        args.unverified,
        ooh_call_acknowledged,
        now,
    );

    if let Some(reported_message) = state.data.reported_messages.get(args.report_index) {
        let reported_message = reported_message.clone();

        // Re-anchor the vault retention clock at filing time: the statutory 1 year runs from
        // the report being sent, not from the verdict. Not a verdict: an unverified filing
        // leaves the record unresolved and awaiting a reviewer. Sent even if the caller has
        // no user record - an unattributed re-anchor beats an early-expiring clock.
        moderation::reanchor_vault_retention(&reported_message.blob_references, caller, state);

        // Flip the alert card's filing state to Filed
        moderation::update_moderation_alert_authority_report(
            &reported_message,
            types::AuthorityReportState::Filed {
                portal_reference: args.portal_reference,
            },
            state,
        );
    }

    if args.unverified {
        // The urgency valve: an honest-unverified report was filed before any verdict; the
        // report's verdict remains open and is resolved by a reviewer
        state
            .data
            .reported_messages
            .mark_unverified_report_filed(args.report_index, now);
    }

    Ok(())
}
