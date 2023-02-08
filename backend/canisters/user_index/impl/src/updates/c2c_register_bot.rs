use crate::updates::set_username::{validate_username, UsernameValidationResult};
use crate::{mutate_state, RuntimeState, USER_LIMIT};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use local_user_index_canister::{Event, UserRegistered};
use types::{Cycles, UserId, Version};
use user_index_canister::c2c_register_bot::{Response::*, *};

const BOT_REGISTRATION_FEE: Cycles = 10_000_000_000_000; // 10T

#[update]
#[trace]
fn c2c_register_bot(args: Args) -> Response {
    mutate_state(|state| c2c_register_bot_impl(args, state))
}

fn c2c_register_bot_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
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

    if runtime_state.data.users.get_by_username(&args.username).is_some() {
        return UsernameTaken;
    }

    let cycles = ic_cdk::api::call::msg_cycles_available128();
    if cycles < BOT_REGISTRATION_FEE {
        return InsufficientCyclesProvided(BOT_REGISTRATION_FEE);
    }
    ic_cdk::api::call::msg_cycles_accept128(BOT_REGISTRATION_FEE);

    runtime_state
        .data
        .users
        .register(caller, user_id, Version::default(), args.username.clone(), now, None, true);

    runtime_state.data.push_event_to_all_local_user_indexes(
        Event::UserRegistered(UserRegistered {
            user_id,
            user_principal: caller,
            username: args.username,
            is_bot: true,
            referred_by: None,
        }),
        None,
    );

    Success
}
