use crate::guards::caller_is_governance_principal;
use crate::{RuntimeState, mutate_state, read_state};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use local_user_index_canister::{PlatformModeratorStatusChanged, UserIndexEvent};
use types::UserId;
use user_canister::c2c_grant_super_admin;
use user_index_canister::add_platform_moderator::{Response::*, *};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn add_platform_moderator(args: Args) -> Response {
    if read_state(|state| is_already_platform_moderator(&args.user_id, state)) {
        return AlreadyPlatformModerator;
    }

    let c2c_args = c2c_grant_super_admin::Args {};
    match user_canister_c2c_client::c2c_grant_super_admin(args.user_id.canister_id(), &c2c_args).await {
        Ok(_) => {
            mutate_state(|state| commit(args.user_id, state));
            Success
        }
        Err(error) => InternalError(format!("{error:?}")),
    }
}

fn is_already_platform_moderator(user_id: &UserId, state: &RuntimeState) -> bool {
    state.data.platform_moderators.contains(user_id)
}

fn commit(user_id: UserId, state: &mut RuntimeState) {
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
}
