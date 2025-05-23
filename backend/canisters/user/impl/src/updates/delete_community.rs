use crate::guards::caller_is_owner;
use crate::{execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_delete_community;
use oc_error_codes::OCErrorCode;
use user_canister::delete_community::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn delete_community(args: Args) -> Response {
    execute_update_async(|| delete_community_impl(args)).await
}

async fn delete_community_impl(args: Args) -> Response {
    if read_state(|state| state.data.suspended.value) {
        return Response::Error(OCErrorCode::InitiatorSuspended.into());
    }

    let c2c_args = c2c_delete_community::Args {};

    match community_canister_c2c_client::c2c_delete_community(args.community_id.into(), &c2c_args).await {
        Ok(result) => {
            if matches!(result, Response::Success) {
                mutate_state(|state| state.data.remove_community(args.community_id, state.env.now()));
            }
            result
        }
        Err(error) => Response::Error(error.into()),
    }
}
