use crate::model::moderation;
use crate::model::reported_messages::ContestResult;
use crate::model::user_map::ContestUploadSanctionResult;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{ModerationReportStatus, OCResult};
use user_index_canister::contest_moderation_sanction::*;

// The GDPR Article 22 safeguard: the sender of an auto-sanctioned message contests the
// automated decision, queuing the report for priority human verdict. Applies to hash-tier
// sanctions (activating the otherwise-unqueued record) and classifier auto-sanctions alike.
#[update(msgpack = true)]
#[trace]
fn contest_moderation_sanction(_args: Args) -> Response {
    mutate_state(contest_moderation_sanction_impl).into()
}

fn contest_moderation_sanction_impl(state: &mut RuntimeState) -> OCResult {
    let caller = state.env.caller();
    let now = state.env.now();

    let user = state
        .data
        .users
        .get_by_principal(&caller)
        .ok_or(OCErrorCode::InitiatorNotFound)?;
    let user_id = user.user_id;
    let report_indexes: Vec<u64> = user.reported_messages.iter().rev().copied().collect();

    // One active contest per REPORT: an already-contested report is skipped so that a user
    // with multiple unresolved sanctions can contest each of them
    let mut saw_already_contested = false;
    for report_index in report_indexes {
        match state.data.reported_messages.mark_contested(report_index, user_id, now) {
            ContestResult::Success(report) => {
                // Surface the contest to the moderators on the alert message
                moderation::update_moderation_alert_status(&report, ModerationReportStatus::Contested, state);
                return Ok(());
            }
            ContestResult::AlreadyContested => saw_already_contested = true,
            // Not this report - keep looking
            ContestResult::NotFound | ContestResult::NotContestable | ContestResult::AlreadyResolved => (),
        }
    }

    // A hash-match suspension has no message and so no report to resolve, but it is still an
    // automated decision the user can require a person to review. Lifting the suspension is
    // the reversal, so the contest is raised as a notice in the moderation channel.
    match state.data.users.contest_csam_upload_sanction(user_id, now) {
        ContestUploadSanctionResult::Success(csam_report_index) => {
            let username = state
                .data
                .users
                .get_by_user_id(&user_id)
                .map(|u| format!("@{}", u.username))
                .unwrap_or_else(|| user_id.to_string());
            moderation::post_moderation_notice(
                format!(
                    "⚖️ Human review requested\n\n\
                     {username} ({user_id}) was suspended for trying to post content matching the hash upheld as CSAM in \
                     report #{csam_report_index}, and has requested that a person reviews that decision. \
                     If the sanction was wrong, unsuspend the account; there is no report to resolve."
                ),
                state,
            );
            return Ok(());
        }
        ContestUploadSanctionResult::AlreadyContested => saw_already_contested = true,
        ContestUploadSanctionResult::NotFound => (),
    }

    if saw_already_contested {
        Err(OCErrorCode::NoChange.with_message("Already contested"))
    } else {
        Err(OCErrorCode::MessageNotFound.with_message("No contestable sanction found"))
    }
}
