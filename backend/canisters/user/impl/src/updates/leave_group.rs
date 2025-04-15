use crate::guards::caller_is_owner;
use crate::{mutate_state, read_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::c2c_leave_group;
use oc_error_codes::OCErrorCode;
use user_canister::leave_group::{Response::*, *};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn leave_group(args: Args) -> Response {
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

    let c2c_args = c2c_leave_group::Args { principal };

    match group_canister_c2c_client::c2c_leave_group(args.chat_id.into(), &c2c_args).await {
        Ok(result) => match result {
            c2c_leave_group::Response::Success(_) => {
                mutate_state(|state| state.data.remove_group(args.chat_id, state.env.now()));
                Success
            }
            c2c_leave_group::Response::Error(error) if error.matches_code(OCErrorCode::InitiatorNotInChat) => {
                mutate_state(|state| state.data.remove_group(args.chat_id, state.env.now()));
                CallerNotInGroup
            }
            c2c_leave_group::Response::Error(error) => Error(error),
        },
        Err(error) => InternalError(format!("{error:?}")),
    }
}
