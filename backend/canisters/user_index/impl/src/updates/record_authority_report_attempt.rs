use crate::guards::caller_is_authority_reporter;
use crate::model::moderation;
use crate::model::reported_messages::{DetectionSource, ReportedMessage};
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{CLAIM_TYPE_NCA_VAULT_EXPORT, Chat, NcaVaultExportClaims, OCResult, UserId};
use user_index_canister::record_authority_report_attempt::*;

#[update(guard = "caller_is_authority_reporter", msgpack = true)]
#[trace]
fn record_authority_report_attempt(args: Args) -> Response {
    match mutate_state(|state| record_authority_report_attempt_impl(args, state)) {
        Ok(data) => Response::Success(data),
        Err(error) => Response::Error(error),
    }
}

fn record_authority_report_attempt_impl(args: Args, state: &mut RuntimeState) -> OCResult<Box<AuthorityReportData>> {
    let now = state.env.now();
    let claims = jwt::verify_and_decode::<NcaVaultExportClaims>(
        &args.vault_token,
        state.data.oc_key_pair.public_key_pem(),
        CLAIM_TYPE_NCA_VAULT_EXPORT,
    )
    .map_err(|_| OCErrorCode::InitiatorNotAuthorized.with_message("Invalid vault token"))?;
    if claims.exp_ms() < now {
        return Err(OCErrorCode::InitiatorNotAuthorized.with_message("Vault token expired"));
    }
    let claims = claims.into_custom();

    // The moderator's authority is re-checked at attempt time, not only at minting: a
    // suspension (or revocation) landing inside the token's validity window must stop the
    // filing before any evidence moves
    let authorised_by_active_reviewer = state
        .data
        .users
        .get_by_user_id(&claims.user_id)
        .is_some_and(|u| u.suspension_details.is_none())
        && state.data.vault_reviewers.contains(&claims.user_id)
        && state.data.platform_moderators.contains(&claims.user_id);
    if !authorised_by_active_reviewer {
        return Err(OCErrorCode::InitiatorNotAuthorized
            .with_message("The moderator who opened this filing window no longer holds the authority to file"));
    }

    let Some(report) = state.data.reported_messages.get(claims.report_index) else {
        return Err(OCErrorCode::MessageNotFound.into());
    };
    let report = report.clone();

    let Some(verdict) = report.human_verdict() else {
        return Err(OCErrorCode::InvalidRequest.with_message("The report has no human verdict"));
    };
    let verdict = VerdictDetails {
        verdict: verdict.verdict,
        moderator: verdict.moderator,
        timestamp: verdict.timestamp,
    };

    // The sender lookup happens BEFORE the marker is opened: a failure after opening it
    // would strand an open attempt for a filing that never started
    let sender = reported_user_details(report.sender, state)
        .ok_or_else(|| OCErrorCode::TargetUserNotFound.with_message("The reported sender no longer exists"))?;
    let recipient = direct_chat_recipient(&report, state);

    // The marker refuses a report that is not due, or that already has an attempt in flight
    if !state
        .data
        .authority_reports
        .record_attempt(claims.report_index, claims.nonce, claims.user_id, now)
    {
        return Err(OCErrorCode::InvalidRequest
            .with_message("The report is not due, or a filing attempt is already marked in flight"));
    }

    // Flip the alert card so moderators see the filing is in progress
    moderation::update_moderation_alert_authority_report(
        &report,
        types::AuthorityReportState::Attempting { started_at: now },
        state,
    );

    let data = AuthorityReportData {
        report_index: claims.report_index,
        sender,
        recipient,
        chat: report.chat_id,
        thread_root_message_index: report.thread_root_message_index,
        message_index: report.message_index,
        message_id: report.message_id,
        detection: match report.detection {
            DetectionSource::UserReport => AuthorityReportDetection::UserReport {
                reporters_include_platform_moderator: report
                    .reports
                    .keys()
                    .any(|reporter| state.data.platform_moderators.contains(reporter)),
            },
            DetectionSource::Proactive => AuthorityReportDetection::Proactive,
            DetectionSource::BlockedAttempt { original_report_index } => {
                AuthorityReportDetection::BlockedAttempt { original_report_index }
            }
        },
        detected_at: report
            .automated_timestamp()
            .or_else(|| report.reports.values().min().copied())
            .unwrap_or(now),
        urgent: state
            .data
            .authority_reports
            .due_entry(claims.report_index)
            .is_some_and(|d| d.urgent),
        verdict,
        flagged_categories: report
            .automated_outcome_flags()
            .unwrap_or(types::ModerationCategories::SEXUAL_MINORS.bits()),
        auto_sanctioned: report.machine_sanction_applied(),
        contested: report.contested.is_some(),
        content_excerpt: report.content_excerpt.clone(),
        media_matches: report.media_matches.clone(),
        files: report.blob_references.clone(),
        repeat_attempts: report.repeat_attempts.clone(),
        unrecorded_repeat_attempts: report.unrecorded_repeat_attempts,
    };

    Ok(Box::new(data))
}

// The recipient of a direct-chat message is likely the child victim the NCA exists to
// safeguard (D8). Only the reporter of a direct-chat message can be its recipient (nobody
// else sees the chat), so the earliest reporter is the recipient; a proactive detection in a
// direct chat has no reporter and so names nobody.
fn direct_chat_recipient(report: &ReportedMessage, state: &RuntimeState) -> Option<ReportedUserDetails> {
    if !matches!(report.chat_id, Chat::Direct(_)) {
        return None;
    }
    let recipient = report
        .reports
        .iter()
        .min_by_key(|(_, timestamp)| **timestamp)
        .map(|(user_id, _)| *user_id)?;
    reported_user_details(recipient, state)
}

fn reported_user_details(user_id: UserId, state: &RuntimeState) -> Option<ReportedUserDetails> {
    let user = state.data.users.get_by_user_id(&user_id)?;
    Some(ReportedUserDetails {
        user_id,
        username: user.username.clone(),
        display_name: user.display_name.clone(),
        date_created: user.date_created,
        suspended: user.suspension_details.is_some(),
        suspension_reason: user.suspension_details.as_ref().map(|d| d.reason.clone()),
    })
}
