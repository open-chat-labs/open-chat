use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use types::ChatId;
use user_index_canister::assign_platform_moderators_group::{Response::*, *};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn assign_platform_moderators_group(args: Args) -> Response {
    mutate_state(|state| assign_platform_moderators_group_impl(args.group_id, state));
    Success
}

fn assign_platform_moderators_group_impl(group_id: ChatId, runtime_state: &mut RuntimeState) {
    if runtime_state.data.platform_moderators_group.is_some() {
        panic!();
    }
    runtime_state.data.platform_moderators_group = Some(group_id);
}
