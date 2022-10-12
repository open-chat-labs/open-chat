use crate::updates::set_username::{validate_username, UsernameValidationResult};
use crate::{mutate_state, RuntimeState, USER_LIMIT};
use canister_api_macros::update_candid_and_msgpack;
use canister_tracing_macros::trace;
use types::{UserId, Version};
use user_index_canister::register_bot::{Response::*, *};

#[update_candid_and_msgpack]
#[trace]
fn register_bot(args: Args) -> Response {
    mutate_state(|state| register_bot_impl(args, state))
}

fn register_bot_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let user_id: UserId = caller.into();
    let now = runtime_state.env.now();

    if runtime_state.data.users.get_by_principal(&caller).is_some()
        || runtime_state.data.users.get_by_user_id(&user_id).is_some()
    {
        return AlreadyRegistered;
    }

    if runtime_state.data.users.len() >= USER_LIMIT {
        return UserLimitReached;
    }

    match validate_username(&args.username) {
        UsernameValidationResult::TooShort(min_length) => return UsernameTooShort(min_length),
        UsernameValidationResult::TooLong(max_length) => return UsernameTooLong(max_length),
        UsernameValidationResult::Invalid => return UsernameInvalid,
        _ => {}
    };

    // TODO charge a fee in cycles to register a bot

    runtime_state.data.users.reserve_username(&args.username);

    if runtime_state.data.users.get_by_username(&args.username) {
        return UsernameTaken;
    }

    runtime_state
        .data
        .users
        .register(caller, user_id, Version::default(), args.username, now, None, true);

    Success
}
