use crate::model::moderation;
use crate::{RuntimeState, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{CLAIM_TYPE_NCA_VAULT_EXPORT, NcaPriority, NcaVaultExportClaims, OCResult};
use user_index_canister::clear_authority_report_attempt::*;

#[update(guard = "caller_is_authority_reporter_or_platform_operator", msgpack = true)]
#[trace]
fn clear_authority_report_attempt(args: Args) -> Response {
    mutate_state(|state| clear_authority_report_attempt_impl(args, state)).into()
}

fn caller_is_authority_reporter_or_platform_operator() -> Result<(), String> {
    read_state(|state| {
        if state.is_caller_authority_reporter() || state.is_caller_platform_operator() {
            Ok(())
        } else {
            Err("Caller is not the authority reporter or a platform operator".to_string())
        }
    })
}

fn clear_authority_report_attempt_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let now = state.env.now();
    let is_operator = state.is_caller_platform_operator();

    // The service must prove it holds the window the attempt belongs to; an operator clears
    // by report index alone (that is what manual reconciliation is for)
    let priority = if is_operator {
        None
    } else {
        let Some(token) = args.vault_token.as_ref() else {
            return Err(OCErrorCode::InitiatorNotAuthorized.with_message("A vault token is required"));
        };
        let claims = jwt::verify_and_decode::<NcaVaultExportClaims>(
            token,
            state.data.oc_key_pair.public_key_pem(),
            CLAIM_TYPE_NCA_VAULT_EXPORT,
        )
        .map_err(|_| OCErrorCode::InitiatorNotAuthorized.with_message("Invalid vault token"))?;
        // Deliberately no expiry check: a slow failure (retries against a downed portal) can
        // outlive the 5-minute window, and refusing the clear would strand the marker. The
        // nonce still has to match the open attempt, which only this token pair carries.
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
        Some(claims.priority)
    };

    if !state.data.authority_reports.clear_attempt(args.report_index, args.failure.clone(), now) {
        return Err(OCErrorCode::InvalidRequest.with_message("No filing attempt is marked in flight"));
    }

    // Flip the alert card to the state the manual checklist keys off
    if let Some(report) = state.data.reported_messages.get(args.report_index) {
        let report = report.clone();
        let urgent = state
            .data
            .authority_reports
            .due_entry(args.report_index)
            .is_some_and(|d| d.urgent);
        let card_state = match &args.failure {
            Some(AuthorityReportFailure::Contingency { error }) => {
                types::AuthorityReportState::ContingencyRequired { error: error.clone() }
            }
            Some(AuthorityReportFailure::Validation { error }) => {
                types::AuthorityReportState::ValidationFailed { error: error.clone() }
            }
            // An auth failure is an operator problem, not a checklist state: back to Due
            Some(AuthorityReportFailure::Auth { .. }) | None => types::AuthorityReportState::Due { urgent },
        };
        moderation::update_moderation_alert_authority_report(&report, card_state, state);
    }

    // The failures which need a human RIGHT NOW go to the moderation channel too: a P1/P2
    // contingency carries a phone-call obligation, and an auth failure means nothing can file
    match &args.failure {
        Some(AuthorityReportFailure::Contingency { error }) => {
            let urgent_note = match priority {
                Some(NcaPriority::P1) | Some(NcaPriority::P2) => {
                    "\n\n⚠️ Priority 1/2: the contingency path (DRB email + control-centre call) is required - open the report's manual filing checklist."
                }
                _ => "\n\nPriority 3 reports wait for the portal - retry from the report card once it is restored.",
            };
            moderation::post_moderation_notice(
                format!("🚨 Automated NCA filing for report #{} failed - the portal appears to be down: {error}{urgent_note}", args.report_index),
                state,
            );
        }
        Some(AuthorityReportFailure::Validation { error }) => {
            moderation::post_moderation_notice(
                format!(
                    "🐞 Automated NCA filing for report #{} was rejected by the NCA's validation - this is an OpenChat defect. File via the web form (see the report's manual checklist) and raise a bug.\n\nNCA error: {error}",
                    args.report_index
                ),
                state,
            );
        }
        Some(AuthorityReportFailure::Auth { error }) => {
            moderation::notify_other_platform_operators(
                format!(
                    "🔑 Automated NCA filing for report #{} failed to authenticate with the NCA API ({error}) - the API key is missing, wrong or revoked. No automated filing can succeed until it is fixed.",
                    args.report_index
                ),
                state,
            );
        }
        None => {}
    }

    Ok(())
}
