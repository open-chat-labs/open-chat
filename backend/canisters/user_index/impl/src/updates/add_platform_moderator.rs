use crate::guards::caller_is_governance_principal;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use local_user_index_canister::{PlatformModeratorStatusChanged, UserIndexEvent};
use user_index_canister::add_platform_moderator::{Response::*, *};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn add_platform_moderator(args: Args) -> Response {
    mutate_state(|state| add_platform_moderator_impl(args, state))
}

fn add_platform_moderator_impl(args: Args, state: &mut RuntimeState) -> Response {
    let user_id = args.user_id;
    if state.data.platform_moderators.contains(&user_id) {
        return AlreadyPlatformModerator;
    }

    state.data.platform_moderators.insert(user_id);
    // A suspended appointee joins the set but the live flag stays off until the suspension
    // lifts (sync_suspended_privileges restores it)
    let suspended = state
        .data
        .users
        .get_by_user_id(&user_id)
        .is_some_and(|u| u.suspension_details.is_some());
    state.push_event_to_all_local_user_indexes(
        UserIndexEvent::PlatformModeratorStatusChanged(PlatformModeratorStatusChanged {
            user_id,
            is_platform_moderator: !suspended,
        }),
        None,
    );
    Success
}
