use crate::guards::caller_is_owner;
use crate::{execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::c2c_delete_group;
use oc_error_codes::OCErrorCode;
use user_canister::delete_group::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn delete_group(args: Args) -> Response {
    execute_update_async(|| delete_group_impl(args)).await
}

async fn delete_group_impl(args: Args) -> Response {
    if read_state(|state| state.data.suspended.value) {
        return Response::Error(OCErrorCode::InitiatorSuspended.into());
    }

    let c2c_args = c2c_delete_group::Args {};

    match group_canister_c2c_client::c2c_delete_group(args.chat_id.into(), &c2c_args).await {
        Ok(result) => {
            if matches!(result, Response::Success) {
                mutate_state(|state| state.data.remove_group(args.chat_id, state.env.now()));
            }
            result
        }
        Err(error) => Response::Error(error.into()),
    }
}
