use crate::guards::caller_is_owner;
use crate::{mutate_state, read_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_leave_community;
use oc_error_codes::OCErrorCode;
use user_canister::leave_community::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn leave_community(args: Args) -> Response {
    run_regular_jobs();

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

    let c2c_args = c2c_leave_community::Args { principal };

    match community_canister_c2c_client::c2c_leave_community(args.community_id.into(), &c2c_args).await {
        Ok(result) => {
            if matches!(result, Response::Success)
                || matches!(&result, Response::Error(error) if error.matches_code(OCErrorCode::InitiatorNotInCommunity))
            {
                mutate_state(|state| state.data.remove_community(args.community_id, state.env.now()));
            }
            result
        }
        Err(error) => Response::Error(error.into()),
    }
}
