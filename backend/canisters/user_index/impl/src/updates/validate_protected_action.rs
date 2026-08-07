use crate::RuntimeState;
use candid::Principal;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use user_index_canister::propose_protected_action::ProtectedAction;

// Validation for the dual-authorized actions, run BOTH when an action is proposed (so the
// proposer finds out immediately) and again when it is confirmed (state can change while a
// proposal sits pending - a report can be resolved, a moderator removed, a hold applied).
// Keeping it in one place is what stops the two checks drifting apart.
pub(crate) fn validate_protected_action(action: &ProtectedAction, state: &RuntimeState) -> OCResult {
    match action {
        ProtectedAction::DestroyVaultEvidence(args) => {
            if args.le_request_ref.trim().is_empty() {
                return Err(OCErrorCode::InvalidRequest.with_message("A law enforcement request reference is required"));
            }
            let report = state
                .data
                .reported_messages
                .get(args.report_index)
                .ok_or(OCErrorCode::MessageNotFound)?;
            if report.blob_references.is_empty() {
                return Err(OCErrorCode::InvalidRequest.with_message("The report holds no vaulted evidence"));
            }
            if report.legal_hold {
                return Err(OCErrorCode::InvalidRequest
                    .with_message("A legal hold stands on this evidence - clear the hold before destroying it"));
            }
        }
        ProtectedAction::SetVaultLegalHold(args) => {
            if args.reference.trim().is_empty() {
                return Err(OCErrorCode::InvalidRequest.with_message("A reference for the request is required"));
            }
            let report = state
                .data
                .reported_messages
                .get(args.report_index)
                .ok_or(OCErrorCode::MessageNotFound)?;
            if report.blob_references.is_empty() {
                return Err(OCErrorCode::InvalidRequest.with_message("The report holds no vaulted evidence"));
            }
        }
        ProtectedAction::SetVaultReviewers(args) => {
            // Checked here as well as at execution so a proposal which can never succeed is
            // never queued in the first place
            if let Some(user_id) = args.user_ids.iter().find(|u| !state.data.platform_moderators.contains(u)) {
                return Err(OCErrorCode::InvalidRequest.with_message(format!("{user_id} is not a platform moderator")));
            }
        }
        ProtectedAction::SetOpenAIApiKey(args) => {
            // Unsetting is `None`; an empty or blank string is a mistake, not an instruction
            if args.api_key.as_ref().is_some_and(|k| k.trim().is_empty()) {
                return Err(OCErrorCode::InvalidRequest
                    .with_message("The API key is blank - to switch detection off, propose unsetting it instead"));
            }
        }
        ProtectedAction::SetInternalModerationChannel(args) => {
            if let Some(channel) = &args.channel {
                // The community's existence cannot be checked from here (the user_index knows
                // nothing about communities), so this catches only structurally impossible
                // ids. Whether the channel exists is verified by the alert failing to post,
                // which is why the proposal shows the ids for the confirmer to check.
                if Principal::from(channel.community_id) == Principal::anonymous() {
                    return Err(OCErrorCode::InvalidRequest.with_message("That is not a valid community id"));
                }
            }
        }
    }

    Ok(())
}
