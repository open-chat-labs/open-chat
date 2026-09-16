use crate::guards::caller_is_local_user_index;
use crate::model::users::AddUserError;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use multi_user_canister::c2c_create_user::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::{OCResult, UserId};

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_create_user(args: Args) -> Response {
    match mutate_state(|state| c2c_create_user_impl(args, state)) {
        Ok(user_id) => Success(user_id),
        Err(error) => Error(error),
    }
}

fn c2c_create_user_impl(args: Args, state: &mut RuntimeState) -> OCResult<UserId> {
    let now = state.env.now();
    let index = state
        .data
        .users
        .add(args.principal, args.username, args.referred_by, now)
        .map_err(|error| match error {
            AddUserError::PrincipalAlreadyRegistered => OCErrorCode::AlreadyRegistered,
            AddUserError::CanisterFull => OCErrorCode::UserLimitReached,
        })?;

    Ok(state.user_id(index))
}
