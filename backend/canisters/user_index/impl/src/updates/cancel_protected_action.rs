use crate::guards::caller_is_platform_operator;
use crate::model::moderation;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use user_index_canister::cancel_protected_action::*;

#[update(guard = "caller_is_platform_operator", msgpack = true)]
#[trace]
fn cancel_protected_action(args: Args) -> Response {
    mutate_state(|state| cancel_protected_action_impl(args, state)).into()
}

fn cancel_protected_action_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let caller = state.env.caller();
    let cancelled_by = state
        .data
        .users
        .get_by_principal(&caller)
        .map(|u| u.user_id)
        .ok_or(OCErrorCode::InitiatorNotFound)?;

    let now = state.env.now();
    let Some(cancelled) = state.data.protected_actions.cancel(args.action_id, cancelled_by, now) else {
        return Err(OCErrorCode::InvalidRequest.with_message("No pending action with that id (it may have expired)"));
    };

    moderation::notify_platform_operators(
        format!(
            "🚫 Protected action #{} cancelled: {}\n\nProposed by {}, cancelled by {cancelled_by}",
            args.action_id,
            cancelled.action.summary(),
            cancelled.proposed_by
        ),
        state,
    );

    Ok(())
}
