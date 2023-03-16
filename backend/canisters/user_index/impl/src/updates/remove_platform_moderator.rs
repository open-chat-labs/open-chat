use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use local_user_index_canister::{Event, SuperAdminStatusChanged};
use user_index_canister::remove_platform_moderator::{Response::*, *};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn remove_platform_moderator(args: Args) -> Response {
    mutate_state(|state| remove_platform_moderator_impl(args, state))
}

fn remove_platform_moderator_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.platform_moderators.remove(&args.user_id) {
        runtime_state.push_event_to_all_local_user_indexes(
            Event::SuperAdminStatusChanged(SuperAdminStatusChanged {
                user_id: args.user_id,
                is_super_admin: false,
            }),
            None,
        );
        Success
    } else {
        NotPlatformModerator
    }
}
