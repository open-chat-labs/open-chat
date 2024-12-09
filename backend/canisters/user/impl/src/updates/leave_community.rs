use crate::guards::caller_is_owner;
use crate::{mutate_state, read_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_leave_community;
use user_canister::leave_community::{Response::*, *};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn leave_community(args: Args) -> Response {
    run_regular_jobs();

    let Ok(principal) = read_state(
        |state| {
            if state.data.suspended.value {
                Err(())
            } else {
                Ok(state.data.owner)
            }
        },
    ) else {
        return UserSuspended;
    };

    let c2c_args = c2c_leave_community::Args { principal };

    match community_canister_c2c_client::c2c_leave_community(args.community_id.into(), &c2c_args).await {
        Ok(result) => match result {
            c2c_leave_community::Response::Success | c2c_leave_community::Response::UserNotInCommunity => {
                mutate_state(|state| state.data.remove_community(args.community_id, state.env.now()));
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
