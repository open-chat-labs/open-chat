use crate::guards::caller_is_platform_operator;
use crate::model::moderation;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use user_index_canister::set_vault_reviewers::*;

// Two-authority grant model: the DAO appoints platform moderators (public-trust gate); OpenChat
// Labs - via a platform operator - designates which of them are vault reviewers (the legal
// designation, tied to training and the Authorized Assessment Procedure). Reviewer duty is a
// voluntary engagement, never an on-chain election.
#[update(guard = "caller_is_platform_operator", msgpack = true)]
#[trace]
fn set_vault_reviewers(args: Args) -> Response {
    mutate_state(|state| set_vault_reviewers_impl(args, state)).into()
}

fn set_vault_reviewers_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    // Constrained on-chain to the DAO-appointed pool
    if let Some(user_id) = args.user_ids.iter().find(|u| !state.data.platform_moderators.contains(u)) {
        return Err(OCErrorCode::InvalidRequest.with_message(format!("{user_id} is not a platform moderator")));
    }

    state.data.vault_reviewers = args.user_ids.into_iter().collect();
    moderation::sync_vault_reviewers(state);

    Ok(())
}
