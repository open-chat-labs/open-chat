use crate::guards::caller_is_governance_principal;
use crate::{RuntimeState, mutate_state};
use canister_tracing_macros::trace;
use ic_cdk::update;
use types::ChatId;
use user_index_canister::assign_platform_moderators_group::{Response::*, *};

// dfx canister call user_index assign_platform_moderators_group '(record { group_id = principal "..." })'
#[update(guard = "caller_is_governance_principal")]
#[trace]
fn assign_platform_moderators_group(args: Args) -> Response {
    mutate_state(|state| assign_platform_moderators_group_impl(args.group_id, state))
}

fn assign_platform_moderators_group_impl(group_id: ChatId, state: &mut RuntimeState) -> Response {
    if let Some(group_id) = state.data.platform_moderators_group {
        AlreadySet(group_id)
    } else {
        state.data.platform_moderators_group = Some(group_id);
        Success
    }
}
