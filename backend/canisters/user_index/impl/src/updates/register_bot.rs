use crate::updates::set_username::{validate_username, UsernameValidationResult};
use crate::{mutate_state, RuntimeState, USER_LIMIT};
use canister_api_macros::update_candid_and_msgpack;
use canister_tracing_macros::trace;
use types::{Cycles, UserId, Version};
use user_index_canister::register_bot::{Response::*, *};

const BOT_REGISTRATION_FEE: Cycles = 10_000_000_000_000; // 10T

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

    let cycles = ic_cdk::api::call::msg_cycles_available128();
    if cycles < BOT_REGISTRATION_FEE {
        return InsufficientCyclesProvided(BOT_REGISTRATION_FEE);
    }
    ic_cdk::api::call::msg_cycles_accept128(BOT_REGISTRATION_FEE);

    if runtime_state.data.users.get_by_username(&args.username).is_some() {
        return UsernameTaken;
    }

    runtime_state
        .data
        .users
        .register(caller, user_id, Version::default(), args.username, now, None, true);

    Success
}
