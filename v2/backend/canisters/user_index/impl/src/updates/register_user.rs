use crate::model::user_map::RegisterUserResult;
use crate::updates::create_canister::create_canister_impl;
use crate::updates::set_username::{validate_username, UsernameValidationResult};
use crate::{mutate_state, RuntimeState, USER_LIMIT};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use user_index_canister::create_canister;
use user_index_canister::register_user::{Response::*, *};

#[update]
#[trace]
async fn register_user(args: Args) -> Response {
    match mutate_state(|state| register_user_impl(args, state)) {
        Ok(_) => (),
        Err(response) => return response,
    };

    match create_canister_impl().await {
        create_canister::Response::CyclesBalanceTooLow => CyclesBalanceTooLow,
        create_canister::Response::InternalError(e) => InternalError(e),
        create_canister::Response::Success(canister_id) => Success(canister_id.into()),
        _ => unreachable!(),
    }
}

fn register_user_impl(args: Args, runtime_state: &mut RuntimeState) -> Result<(), Response> {
    if runtime_state.data.users.len() >= USER_LIMIT {
        return Err(UserLimitReached);
    }

    match validate_username(&args.username) {
        UsernameValidationResult::TooShort(min_length) => return Err(UsernameTooShort(min_length)),
        UsernameValidationResult::TooLong(max_length) => return Err(UsernameTooLong(max_length)),
        UsernameValidationResult::Invalid => return Err(UsernameInvalid),
        _ => {}
    };

    let caller = runtime_state.env.caller();
    let now = runtime_state.env.now();

    match runtime_state.data.users.register(caller, args.username, now) {
        RegisterUserResult::AlreadyExists => Err(AlreadyRegistered),
        RegisterUserResult::UsernameTaken => Err(UsernameTaken),
        RegisterUserResult::Success => Ok(()),
    }
}
