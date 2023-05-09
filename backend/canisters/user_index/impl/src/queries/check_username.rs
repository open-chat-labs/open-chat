use crate::updates::set_username::{validate_username, UsernameValidationResult};
use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use user_index_canister::check_username::{Response::*, *};

#[query]
fn check_username(args: Args) -> Response {
    read_state(|state| check_username_impl(args, state))
}

fn check_username_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    match validate_username(&args.username) {
        UsernameValidationResult::Ok => {
            if runtime_state.data.users.does_username_exist(&args.username) {
                UsernameTaken
            } else {
                Success
            }
        }
        UsernameValidationResult::TooShort(min_length) => UsernameTooShort(min_length),
        UsernameValidationResult::TooLong(max_length) => UsernameTooLong(max_length),
        UsernameValidationResult::Invalid => UsernameInvalid,
    }
}
