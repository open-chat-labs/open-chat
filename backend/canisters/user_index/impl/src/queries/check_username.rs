use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use user_index_canister::check_username::{Response::*, *};
use utils::text_validation::{validate_username, UsernameValidationError};

#[query(candid = true, msgpack = true)]
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
            if state.data.users.does_username_exist(&args.username, args.is_bot) {
                UsernameTaken
            } else {
                Success
            }
        }
        Err(UsernameValidationError::TooShort(s)) => UsernameTooShort(s.min_length as u16),
        Err(UsernameValidationError::TooLong(l)) => UsernameTooLong(l.max_length as u16),
        Err(UsernameValidationError::Invalid) => UsernameInvalid,
    }
}
