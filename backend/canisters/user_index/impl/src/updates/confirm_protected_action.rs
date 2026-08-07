use crate::guards::caller_is_platform_operator;
use crate::model::moderation;
use crate::model::protected_actions::ConfirmOutcome;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use user_index_canister::confirm_protected_action::*;
use user_index_canister::propose_protected_action::ProtectedAction;

#[update(guard = "caller_is_platform_operator", msgpack = true)]
#[trace]
fn confirm_protected_action(args: Args) -> Response {
    mutate_state(|state| confirm_protected_action_impl(args, state)).into()
}

fn confirm_protected_action_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let caller = state.env.caller();
    let confirmed_by = state
        .data
        .users
        .get_by_principal(&caller)
        .map(|u| u.user_id)
        .ok_or(OCErrorCode::InitiatorNotFound)?;

    // The confirm consumes the proposal, then executes. If execution fails (eg. the report's
    // evidence was released between propose and confirm) the failure is posted to the
    // moderation channel and the action must be re-proposed - a consumed proposal never
    // lingers in an ambiguous half-executed state
    // Validated before the proposal is consumed: a transient failure (a hold applied and
    // later cleared, say) must leave the proposal standing rather than destroying it
    let action = state
        .data
        .protected_actions
        .get(args.action_id)
        .map(|p| p.action.clone())
        .ok_or_else(|| OCErrorCode::InvalidRequest.with_message("No pending action with that id (it may have expired)"))?;
    crate::model::protected_actions::validate(&action, state)?;

    let pending = {
        let now = state.env.now();
        match state
            .data
            .protected_actions
            .confirm(args.action_id, caller, confirmed_by, now)
        {
            ConfirmOutcome::Confirmed(pending) => pending,
            ConfirmOutcome::NotFound => {
                return Err(OCErrorCode::InvalidRequest.with_message("No pending action with that id (it may have expired)"));
            }
            ConfirmOutcome::ProposerCannotConfirm => {
                return Err(OCErrorCode::InvalidRequest.with_message("A proposal cannot be confirmed by its proposer"));
            }
        }
    };

    let summary = pending.action.summary();
    let proposed_by = pending.proposed_by;

    let result = match pending.action {
        ProtectedAction::DestroyVaultEvidence(destroy_args) => {
            crate::updates::destroy_vault_evidence::execute(destroy_args, proposed_by, confirmed_by, state)
        }
        ProtectedAction::SetVaultReviewers(reviewer_args) => crate::updates::set_vault_reviewers::execute(reviewer_args, state),
        ProtectedAction::SetOpenAIApiKey(key_args) => crate::updates::set_openai_api_key::execute(key_args, state),
        ProtectedAction::SetVaultLegalHold(hold_args) => crate::updates::set_vault_legal_hold::execute(hold_args, state),
        ProtectedAction::SetInternalModerationChannel(channel_args) => {
            crate::updates::set_internal_moderation_channel::execute(channel_args, state)
        }
    };

    match &result {
        Ok(()) => {
            moderation::notify_other_platform_operators(
                format!(
                    "✅ Protected action #{} confirmed and executed: {summary}\n\nProposed by @UserId({proposed_by}), confirmed by @UserId({confirmed_by})",
                    args.action_id
                ),
                state,
            );
        }
        Err(error) => {
            // The proposal was consumed by the confirm; record the failure where moderators
            // can see it so the action can be re-proposed
            moderation::notify_other_platform_operators(
                format!(
                    "⚠️ Protected action #{} confirmed but failed to execute: {summary}\n\nError: {error:?}. Re-propose if still required",
                    args.action_id
                ),
                state,
            );
        }
    }

    result
}
