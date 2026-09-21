use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state, read_state};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::c2c_leave_group;
use oc_error_codes::OCErrorCode;
use types::{OCResult, UserId};
use user_canister::leave_group::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn leave_group(args: Args) -> Response {
    let (my_index, principal, my_user_id) = match read_state(prepare) {
        Ok(ok) => ok,
        Err(error) => return Response::Error(error),
    };

    let c2c_args = c2c_leave_group::Args {
        principal,
        user_id: Some(my_user_id),
    };

    // As in the User canister, the group is removed if the user has left it or was not in it
    match group_canister_c2c_client::c2c_leave_group(args.chat_id.into(), &c2c_args).await {
        Ok(c2c_leave_group::Response::Success(_)) => {
            mutate_state(|state| state.remove_group(my_index, args.chat_id, state.env.now()));
            Response::Success
        }
        Ok(c2c_leave_group::Response::Error(error)) if error.matches_code(OCErrorCode::InitiatorNotInChat) => {
            mutate_state(|state| state.remove_group(my_index, args.chat_id, state.env.now()));
            Response::Error(OCErrorCode::InitiatorNotInChat.into())
        }
        Ok(c2c_leave_group::Response::Error(error)) => Response::Error(error),
        Err(error) => Response::Error(error.into()),
    }
}

// The caller's index and principal, and their user id, provided they aren't suspended
fn prepare(state: &RuntimeState) -> OCResult<(u16, Principal, UserId)> {
    state.with_caller_user(|my_index, user| {
        user.verify_not_suspended()?;
        Ok((my_index, user.principal, state.user_id(my_index)))
    })
}
