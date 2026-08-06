use crate::guards::caller_is_platform_operator;
use crate::model::moderation;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use user_index_canister::propose_protected_action::*;

#[update(guard = "caller_is_platform_operator", msgpack = true)]
#[trace]
fn propose_protected_action(args: Args) -> Response {
    mutate_state(|state| propose_protected_action_impl(args, state))
}

fn propose_protected_action_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let Some(proposed_by) = state.data.users.get_by_principal(&caller).map(|u| u.user_id) else {
        return Response::Error(OCErrorCode::InitiatorNotFound.into());
    };

    // Reject obviously invalid proposals up front; the authoritative validation runs again
    // inside the action's implementation at confirm time
    if let ProtectedAction::DestroyVaultEvidence(destroy) = &args.action
        && destroy.le_request_ref.trim().is_empty()
    {
        return Response::Error(OCErrorCode::InvalidRequest.with_message("A law enforcement request reference is required"));
    }

    let now = state.env.now();
    let summary = args.action.summary();
    let action_id = state.data.protected_actions.propose(args.action, caller, proposed_by, now);

    moderation::post_moderation_notice(
        format!(
            "🔐 Protected action #{action_id} proposed: {summary}\n\nBy {proposed_by} — executes only once a different platform operator confirms it"
        ),
        state,
    );

    Response::Success(SuccessResult { action_id })
}
