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

    // Same validation the confirmation will run, so an impossible proposal is never queued
    if let Err(error) = crate::model::protected_actions::validate(&args.action, state) {
        return Response::Error(error);
    }

    let now = state.env.now();
    let summary = args.action.summary();
    let (action_id, already_pending) = state.data.protected_actions.propose(args.action, caller, proposed_by, now);

    // An identical action was already queued, so this changed nothing - don't alert the
    // moderators a second time for the same pending decision
    if !already_pending {
        moderation::notify_other_platform_operators(
            format!(
                "🔐 Protected action #{action_id} proposed: {summary}\n\nBy @UserId({proposed_by}) — executes only once a different platform operator confirms it"
            ),
            state,
        );
    }

    Response::Success(SuccessResult {
        action_id,
        already_pending,
    })
}
