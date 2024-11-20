use crate::{mutate_state, RuntimeState, USER_LIMIT};
use canister_tracing_macros::trace;
use event_store_producer::EventBuilder;
use ic_cdk::update;
use local_user_index_canister::{Event, UserRegistered};
use types::{Cycles, UserId, UserType};
use user_index_canister::c2c_register_bot::{Response::*, *};
use utils::text_validation::{validate_display_name, validate_username, UsernameValidationError};

const BOT_REGISTRATION_FEE: Cycles = 10_000_000_000_000; // 10T

#[update]
#[trace]
fn c2c_register_bot(args: Args) -> Response {
    mutate_state(|state| c2c_register_bot_impl(args, state))
}

fn c2c_register_bot_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let user_id: UserId = caller.into();
    let now = state.env.now();

    if state.data.users.get_by_principal(&caller).is_some() || state.data.users.get_by_user_id(&user_id).is_some() {
        return AlreadyRegistered;
    }

    if state.data.users.len() >= USER_LIMIT {
        return UserLimitReached;
    }

    match validate_username(&args.username) {
        Ok(_) => {}
        Err(UsernameValidationError::TooShort(s)) => return UsernameTooShort(s.min_length as u16),
        Err(UsernameValidationError::TooLong(l)) => return UsernameTooLong(l.max_length as u16),
        Err(UsernameValidationError::Invalid) => return UsernameInvalid,
    };

    if state.data.users.get_by_username(&args.username).is_some() {
        return UsernameTaken;
    }

    if let Some(display_name) = &args.display_name {
        match validate_display_name(display_name) {
            Ok(_) => {}
            Err(UsernameValidationError::TooShort(s)) => return DisplayNameTooShort(s.min_length as u16),
            Err(UsernameValidationError::TooLong(l)) => return DisplayNameTooLong(l.max_length as u16),
            Err(UsernameValidationError::Invalid) => return DisplayNameInvalid,
        }
    }
    ic_cdk::api::call::msg_cycles_accept128(BOT_REGISTRATION_FEE);

    state.data.users.register(
        caller,
        user_id,
        args.username.clone(),
        args.display_name,
        now,
        None,
        UserType::Bot,
        Some(args.config.into()),
    );

    state.push_event_to_all_local_user_indexes(
        Event::UserRegistered(UserRegistered {
            user_id,
            user_principal: caller,
            username: args.username,
            user_type: UserType::Bot,
            referred_by: None,
        }),
        None,
    );

    state.data.event_store_client.push(
        EventBuilder::new("user_registered", now)
            .with_user(user_id.to_string(), true)
            .with_source(state.env.canister_id().to_string(), false)
            .with_json_payload(&crate::UserRegisteredEventPayload {
                referred: false,
                is_bot: true,
            })
            .build(),
    );

    Success
}
