use crate::guards::caller_is_governance_principal;
use crate::{RuntimeState, mutate_state, read_state};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use local_user_index_canister::{PlatformModeratorStatusChanged, UserIndexEvent};
use types::UserId;
use user_canister::c2c_revoke_super_admin;
use user_index_canister::remove_platform_moderator::{Response::*, *};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn remove_platform_moderator(args: Args) -> Response {
    if !read_state(|state| state.data.platform_moderators.contains(&args.user_id)) {
        return NotPlatformModerator;
    }

    let c2c_args = c2c_revoke_super_admin::Args {};
    match user_canister_c2c_client::c2c_revoke_super_admin(args.user_id.into(), &c2c_args).await {
        Ok(_) => {
            mutate_state(|state| commit(args.user_id, state));
            Success
        }
        Err(error) => InternalError(format!("{error:?}")),
    }
}

fn commit(user_id: UserId, state: &mut RuntimeState) {
    state.data.platform_moderators.remove(&user_id);

    state.push_event_to_all_local_user_indexes(
        UserIndexEvent::PlatformModeratorStatusChanged(PlatformModeratorStatusChanged {
            user_id,
            is_platform_moderator: false,
        }),
        None,
    );
}
