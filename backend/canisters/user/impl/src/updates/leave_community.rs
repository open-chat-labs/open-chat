use crate::guards::caller_is_owner;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::c2c_leave_community;
use ic_cdk_macros::update;
use types::CommunityId;
use user_canister::leave_community::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
async fn leave_community(args: Args) -> Response {
    run_regular_jobs();

    if read_state(|state| state.data.suspended.value) {
        return UserSuspended;
    }

    let c2c_args = c2c_leave_community::Args {};

    match community_canister_c2c_client::c2c_leave_community(args.community_id.into(), &c2c_args).await {
        Ok(result) => match result {
            c2c_leave_community::Response::Success | c2c_leave_community::Response::UserNotInCommunity => {
                mutate_state(|state| commit(args.community_id, state));
                if matches!(result, c2c_leave_community::Response::UserNotInCommunity) {
                    UserNotInCommunity
                } else {
                    Success
                }
            }
            c2c_leave_community::Response::LastOwnerCannotLeave => LastOwnerCannotLeave,
            c2c_leave_community::Response::UserSuspended => UserSuspended,
            c2c_leave_community::Response::CommunityFrozen => CommunityFrozen,
        },
        Err(error) => InternalError(format!("{error:?}")),
    }
}

pub(crate) fn commit(community_id: CommunityId, runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();
    runtime_state.data.communities.remove(community_id, now);
}
