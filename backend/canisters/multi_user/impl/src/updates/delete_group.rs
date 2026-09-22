use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state, read_state};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::c2c_delete_group;
use types::{OCResult, UserId};
use user_canister::delete_group::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn delete_group(args: Args) -> Response {
    let (my_index, _, my_user_id) = match read_state(prepare) {
        Ok(ok) => ok,
        Err(error) => return Response::Error(error),
    };

    let c2c_args = c2c_delete_group::Args {
        user_id: Some(my_user_id),
    };

    match group_canister_c2c_client::c2c_delete_group(args.chat_id.into(), &c2c_args).await {
        Ok(result) => {
            if matches!(result, Response::Success) {
                mutate_state(|state| state.remove_group(my_index, args.chat_id, state.env.now()));
            }
            result
        }
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
