use crate::model::user::User;
use crate::model::user_map::RegisterUserResult;
use crate::updates::set_profile::{validate_username, UsernameValidationResult};
use crate::{mutate_state, RuntimeState, USER_LIMIT};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use user_index_canister::register_user::{Response::*, *};

#[update]
#[trace]
fn register_user(args: Args) -> Response {
    mutate_state(|state| register_user_impl(args, state))
}

fn register_user_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.users.len() >= USER_LIMIT {
        return UserLimitReached;
    }

    match validate_username(&args.username) {
        UsernameValidationResult::TooShort(min_length) => return UsernameTooShort(min_length),
        UsernameValidationResult::TooLong(max_length) => return UsernameTooLong(max_length),
        UsernameValidationResult::Invalid => return UsernameInvalid,
        _ => {}
    };

    let caller = runtime_state.env.caller();

    if let Some(User::Unconfirmed(_)) = runtime_state.data.users.get_by_principal(&caller) {
        runtime_state.data.users.remove_by_principal(&caller);
    }

    let now = runtime_state.env.now();

    match runtime_state.data.users.register(caller, args.username, now) {
        RegisterUserResult::AlreadyExists => AlreadyRegistered,
        RegisterUserResult::UsernameTaken => UsernameTaken,
        RegisterUserResult::Success => Success,
    }
}
