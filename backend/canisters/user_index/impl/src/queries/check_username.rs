use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use user_index_canister::check_username::{Response::*, *};
use utils::text_validation::{validate_username, UsernameValidationError};

#[query]
fn check_username(args: Args) -> Response {
    read_state(|state| check_username_impl(args, state))
}

fn check_username_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();
    if let Some(user) = state.data.users.get(&caller) {
        if user.username.to_lowercase() == args.username.to_lowercase() {
            return Success;
        }
    }

    match validate_username(&args.username) {
        Ok(_) => {
            if state.data.users.does_username_exist(&args.username) {
                UsernameTaken
            } else {
                Success
            }
        }
        Err(UsernameValidationError::TooShort(min_length)) => UsernameTooShort(min_length),
        Err(UsernameValidationError::TooLong(max_length)) => UsernameTooLong(max_length),
        Err(UsernameValidationError::Invalid) => UsernameInvalid,
    }
}
