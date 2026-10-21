use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use user_index_canister::link_bridged_user::*;

#[update(msgpack = true)]
#[trace]
fn link_bridged_user(args: Args) -> Response {
    match mutate_state(|state| link_bridged_user_impl(args, state)) {
        Ok(result) => Response::Success(result),
        Err(error) => Response::Error(error),
    }
}

fn link_bridged_user_impl(args: Args, state: &mut RuntimeState) -> OCResult<SuccessResult> {
    state.check_caller_is_bridge_bot(args.user.platform())?;
    args.user
        .validate()
        .map_err(|error| OCErrorCode::InvalidRequest.with_message(error))?;

    let now = state.env.now();
    let user_id = state
        .data
        .bridged_users
        .link(args.user, &args.code, now)
        .ok_or_else(|| OCErrorCode::InvalidRequest.with_message("The code is unknown or has expired"))?;

    let username = state
        .data
        .users
        .get_by_user_id(&user_id)
        .map(|user| user.username.clone())
        .unwrap_or_default();

    Ok(SuccessResult { user_id, username })
}
