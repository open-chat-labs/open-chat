use crate::model::reported_messages::DetectionSource;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::MINUTE_IN_MS;
use jwt::Claims;
use oc_error_codes::OCErrorCode;
use rand::RngExt;
use types::{
    CLAIM_TYPE_NCA_SUBMITTER, CLAIM_TYPE_NCA_VAULT_EXPORT, Milliseconds, NcaSubmitterClaims, NcaVaultExportClaims, OCResult,
};
use user_index_canister::authority_report_token::*;

// The tokens authorize a CSAM evidence export: long enough for the service to register the
// attempt and start pulling chunks (sessions stay open bucket-side), short enough that a
// leaked token is stale almost immediately
const TOKEN_VALIDITY: Milliseconds = 5 * MINUTE_IN_MS;

#[update(msgpack = true)]
#[trace]
fn authority_report_token(args: Args) -> Response {
    match mutate_state(|state| authority_report_token_impl(args, state)) {
        Ok(result) => Response::Success(result),
        Err(error) => Response::Error(error),
    }
}

fn authority_report_token_impl(args: Args, state: &mut RuntimeState) -> OCResult<SuccessResult> {
    let caller = state.env.caller();
    let Some(user) = state.data.users.get_by_principal(&caller) else {
        return Err(OCErrorCode::InitiatorNotFound.into());
    };
    // A suspended account holds no authority: it must not be able to open a CSAM export window
    if user.suspension_details.is_some() {
        return Err(OCErrorCode::InitiatorSuspended.into());
    }
    let user_id = user.user_id;

    // Both, not just vault reviewer: set_vault_reviewers enforces the subset at grant time,
    // but a user can later be removed as a platform moderator without being removed as a
    // vault reviewer
    if !state.data.vault_reviewers.contains(&user_id) || !state.data.platform_moderators.contains(&user_id) {
        return Err(OCErrorCode::InitiatorNotAuthorized
            .with_message("Only a vault reviewer who is a current platform moderator can open a filing window"));
    }

    if state.data.authority_reporter.is_none() {
        return Err(OCErrorCode::InvalidRequest.with_message("No authority reporting service is registered"));
    }

    // Due membership implies an UpheldAsCsam verdict exists (D11), and the verdict-presence
    // check below keeps that true by construction rather than by convention
    if !state.data.authority_reports.is_due(args.report_index) {
        return Err(OCErrorCode::InvalidRequest.with_message("The report does not owe an authority filing"));
    }
    if let Some(attempt) = state.data.authority_reports.attempt(args.report_index) {
        return Err(OCErrorCode::InvalidRequest.with_message(format!(
            "A filing attempt opened at {} is still marked in flight - reconcile it (check the portal's \"Previously submitted reports\") before re-filing",
            attempt.started_at
        )));
    }

    let Some(report) = state.data.reported_messages.get(args.report_index) else {
        return Err(OCErrorCode::MessageNotFound.into());
    };
    if report.human_verdict().is_none() {
        return Err(OCErrorCode::InvalidRequest
            .with_message("The report has no human verdict - the automated path never files unverified reports"));
    }

    // Mirrors the self-report guard on record_authority_report_filed: the subject of a report
    // must not control its filing
    if report.sender == user_id {
        return Err(OCErrorCode::InitiatorNotAuthorized.with_message(
            "You are recorded as the sender of the reported message, and the subject of a report can never control its filing to the NCA - ask a different vault reviewer to file this report",
        ));
    }
    if let DetectionSource::BlockedAttempt { original_report_index } = report.detection
        && state
            .data
            .reported_messages
            .get(original_report_index)
            .is_some_and(|original| original.sender == user_id)
    {
        return Err(OCErrorCode::InitiatorNotAuthorized.with_message(
            "This report records a blocked attempt to re-post content which YOU are recorded as originally sending, and the subject of the underlying content can never control its filing to the NCA - ask a different vault reviewer to file this report",
        ));
    }

    let contact = &args.reporter;
    if [&contact.first_name, &contact.last_name, &contact.phone, &contact.email]
        .iter()
        .any(|v| v.trim().is_empty())
    {
        return Err(OCErrorCode::InvalidRequest.with_message("The reporter's name, phone and email are all required"));
    }

    let now = state.env.now();
    let expiry = now + TOKEN_VALIDITY;
    let nonce: u128 = state.env.rng().random();

    let vault_claims = Claims::new(
        expiry,
        CLAIM_TYPE_NCA_VAULT_EXPORT.to_string(),
        NcaVaultExportClaims {
            report_index: args.report_index,
            user_id,
            priority: args.priority,
            sender: report.sender,
            chat: report.chat_id,
            thread_root_message_index: report.thread_root_message_index,
            message_index: report.message_index,
            message_id: report.message_id,
            files: report.blob_references.iter().map(types::NcaFileClaim::from).collect(),
            ooh_call_acknowledged: args.ooh_call_acknowledged,
            nonce,
        },
    );
    let submitter_claims = Claims::new(
        expiry,
        CLAIM_TYPE_NCA_SUBMITTER.to_string(),
        NcaSubmitterClaims {
            report_index: args.report_index,
            nonce,
            first_name: contact.first_name.clone(),
            last_name: contact.last_name.clone(),
            phone: contact.phone.clone(),
            country_calling_code: contact.country_calling_code.clone(),
            email: contact.email.clone(),
        },
    );

    let secret_key_der = state.data.oc_key_pair.secret_key_der().to_vec();
    let vault_token = jwt::sign_and_encode_token(&secret_key_der, vault_claims, state.env.rng())
        .map_err(|e| OCErrorCode::Unknown.with_message(format!("Failed to sign token: {e:?}")))?;
    let submitter_token = jwt::sign_and_encode_token(&secret_key_der, submitter_claims, state.env.rng())
        .map_err(|e| OCErrorCode::Unknown.with_message(format!("Failed to sign token: {e:?}")))?;

    Ok(SuccessResult {
        vault_token,
        submitter_token,
    })
}
