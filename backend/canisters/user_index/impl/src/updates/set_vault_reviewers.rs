use crate::RuntimeState;
use crate::model::moderation;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use user_index_canister::set_vault_reviewers::Args;

// Two-authority grant model: the DAO appoints platform moderators (public-trust gate); OpenChat
// Labs - via a platform operator - designates which of them are vault reviewers (the legal
// designation, tied to training and the Authorized Assessment Procedure). Reviewer duty is a
// voluntary engagement, never an on-chain election. Because a grant opens access to vaulted
// material, it additionally sits behind dual authorization (#9136): reachable only via
// propose_protected_action + confirm_protected_action by two different platform operators.
pub(crate) fn execute(args: Args, state: &mut RuntimeState) -> OCResult {
    // Constrained on-chain to the DAO-appointed pool
    if let Some(user_id) = args.user_ids.iter().find(|u| !state.data.platform_moderators.contains(u)) {
        return Err(OCErrorCode::InvalidRequest.with_message(format!("{user_id} is not a platform moderator")));
    }

    state.data.vault_reviewers = args.user_ids.into_iter().collect();
    moderation::sync_vault_reviewers(state);

    Ok(())
}
