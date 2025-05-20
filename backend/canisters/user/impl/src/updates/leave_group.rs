use crate::guards::caller_is_owner;
use crate::{execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::c2c_leave_group;
use oc_error_codes::OCErrorCode;
use user_canister::leave_group::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn leave_group(args: Args) -> Response {
    execute_update_async(|| leave_group_impl(args)).await
}

async fn leave_group_impl(args: Args) -> Response {
    let principal = match read_state(|state| {
        if state.data.suspended.value {
            Err(OCErrorCode::InitiatorSuspended.into())
        } else {
            Ok(state.data.owner)
        }
    }) {
        Ok(ok) => ok,
        Err(error) => return Response::Error(error),
    };

    let c2c_args = c2c_leave_group::Args { principal };

    match group_canister_c2c_client::c2c_leave_group(args.chat_id.into(), &c2c_args).await {
        Ok(result) => match result {
            c2c_leave_group::Response::Success(_) => {
                mutate_state(|state| state.data.remove_group(args.chat_id, state.env.now()));
                Response::Success
            }
            c2c_leave_group::Response::Error(error) if error.matches_code(OCErrorCode::InitiatorNotInChat) => {
                mutate_state(|state| state.data.remove_group(args.chat_id, state.env.now()));
                Response::Error(OCErrorCode::InitiatorNotInChat.into())
            }
            c2c_leave_group::Response::Error(error) => Response::Error(error),
        },
        Err(error) => Response::Error(error.into()),
    }
}
