use crate::guards::caller_is_owner;
use crate::{mutate_state, read_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_delete_community;
use user_canister::delete_community::{Response::*, *};

#[update(guard = "caller_is_owner", candid = true, msgpack = true)]
#[trace]
async fn delete_community(args: Args) -> Response {
    run_regular_jobs();

    if read_state(|state| state.data.suspended.value) {
        return UserSuspended;
    }

    let c2c_args = c2c_delete_community::Args {};

    match community_canister_c2c_client::c2c_delete_community(args.community_id.into(), &c2c_args).await {
        Ok(result) => match result {
            c2c_delete_community::Response::Success => {
                mutate_state(|state| state.data.remove_community(args.community_id, state.env.now()));
                Success
            }
            c2c_delete_community::Response::NotAuthorized => NotAuthorized,
            c2c_delete_community::Response::CommunityFrozen => CommunityFrozen,
            c2c_delete_community::Response::UserSuspended => UserSuspended,
            c2c_delete_community::Response::UserLapsed => UserLapsed,
            c2c_delete_community::Response::InternalError(error) => InternalError(error),
        },
        Err(error) => InternalError(format!("{error:?}")),
    }
}
