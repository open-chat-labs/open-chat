use crate::model::user::{CreatedUser, User};
use crate::model::user_map::UpdateUserResult;
use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use types::{CanisterCreationStatusInternal, CyclesTopUp};
use user_index_canister::set_username::{Response::*, *};

const MAX_USERNAME_LENGTH: u16 = 25;
const MIN_USERNAME_LENGTH: u16 = 2;
const INVALID_CHARS: [char; 2] = [' ', ','];

#[update]
fn set_username(args: Args) -> Response {
    RUNTIME_STATE.with(|state| set_username_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn set_username_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = &runtime_state.env.caller();
    let now = runtime_state.env.now();

    runtime_state.data.users.mark_online(caller, now);

    let username = args.username;

    if username.len() > MAX_USERNAME_LENGTH as usize {
        return UsernameTooLong(MAX_USERNAME_LENGTH);
    }

    if username.len() < MIN_USERNAME_LENGTH as usize {
        return UsernameTooShort(MIN_USERNAME_LENGTH);
    }

    if username.chars().any(|c| INVALID_CHARS.contains(&c)) {
        return UsernameInvalid;
    }

    if let Some(user) = runtime_state.data.users.get_by_principal(caller) {
        let user_to_update = match user {
            User::Unconfirmed(_) => {
                return UserUnconfirmed;
            }
            User::Confirmed(user) => {
                if let CanisterCreationStatusInternal::Created(canister_id, wasm_version, cycles) =
                    &user.canister_creation_status
                {
                    let created_user = CreatedUser {
                        principal: user.principal,
                        phone_number: user.phone_number.clone(),
                        user_id: (*canister_id).into(),
                        username,
                        date_created: now,
                        date_updated: now,
                        last_online: now,
                        wasm_version: *wasm_version,
                        upgrade_in_progress: false,
                        cycle_top_ups: vec![CyclesTopUp {
                            amount: *cycles,
                            date: now,
                        }],
                    };
                    User::Created(created_user)
                } else {
                    let mut user = user.clone();
                    user.username = Some(username);
                    User::Confirmed(user)
                }
            }
            User::Created(user) => {
                let mut user = user.clone();
                user.username = username;
                User::Created(user)
            }
        };
        match runtime_state.data.users.update(user_to_update) {
            UpdateUserResult::Success => Success,
            UpdateUserResult::PhoneNumberTaken => panic!("PhoneNumberTaken returned when updating username"),
            UpdateUserResult::UsernameTaken => UsernameTaken,
            UpdateUserResult::UserNotFound => UserNotFound,
        }
    } else {
        UserNotFound
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::user::{CreatedUser, UnconfirmedUser, User};
    use crate::Data;
    use candid::Principal;
    use phonenumber::PhoneNumber;
    use std::str::FromStr;
    use types::Version;
    use utils::env::test::TestEnv;

    #[test]
    fn valid_username_succeeds() {
        let env = TestEnv::default();
        let mut data = Data::default();
        data.users.add(User::Created(CreatedUser {
            principal: env.caller,
            phone_number: PhoneNumber::from_str("+44 1111 111 111").unwrap(),
            user_id: Principal::from_slice(&[1]).into(),
            username: "abc".to_string(),
            date_created: env.now,
            date_updated: env.now,
            last_online: env.now,
            upgrade_in_progress: false,
            wasm_version: Version::new(0, 0, 0),
        }));
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            username: "xyz".to_string(),
        };
        let result = set_username_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::Success));

        let user = runtime_state.data.users.get_by_username("xyz").unwrap();

        assert_eq!(user.get_username().unwrap(), "xyz");
    }

    #[test]
    fn no_change_to_username_succeeds() {
        let env = TestEnv::default();
        let mut data = Data::default();
        data.users.add(User::Created(CreatedUser {
            principal: env.caller,
            phone_number: PhoneNumber::from_str("+44 1111 111 111").unwrap(),
            user_id: Principal::from_slice(&[1]).into(),
            username: "abc".to_string(),
            date_created: env.now,
            date_updated: env.now,
            last_online: env.now,
            upgrade_in_progress: false,
            wasm_version: Version::new(0, 0, 0),
        }));
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            username: "abc".to_string(),
        };
        let result = set_username_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::Success));
    }

    #[test]
    fn username_taken() {
        let env = TestEnv::default();
        let mut data = Data::default();
        data.users.add(User::Created(CreatedUser {
            principal: Principal::from_slice(&[1]),
            phone_number: PhoneNumber::from_str("+44 1111 111 111").unwrap(),
            user_id: Principal::from_slice(&[1]).into(),
            username: "abc".to_string(),
            date_created: env.now,
            date_updated: env.now,
            last_online: env.now,
            upgrade_in_progress: false,
            wasm_version: Version::new(0, 0, 0),
        }));
        data.users.add(User::Created(CreatedUser {
            principal: Principal::from_slice(&[2]),
            phone_number: PhoneNumber::from_str("+44 2222 222 222").unwrap(),
            user_id: Principal::from_slice(&[2]).into(),
            username: "xyz".to_string(),
            date_created: env.now,
            date_updated: env.now,
            last_online: env.now,
            upgrade_in_progress: false,
            wasm_version: Version::new(0, 0, 0),
        }));
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            username: "xyz".to_string(),
        };
        let result = set_username_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::UsernameTaken));
    }

    #[test]
    fn unconfirmed_user() {
        let env = TestEnv::default();
        let mut data = Data::default();
        data.users.add(User::Unconfirmed(UnconfirmedUser {
            principal: env.caller,
            phone_number: PhoneNumber::from_str("+44 1111 111 111").unwrap(),
            confirmation_code: "123456".to_string(),
            date_generated: env.now,
            sms_messages_sent: 1,
        }));
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            username: "abc".to_string(),
        };
        let result = set_username_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::UserUnconfirmed));
    }

    #[test]
    fn invalid_username() {
        let env = TestEnv::default();
        let mut data = Data::default();
        data.users.add(User::Created(CreatedUser {
            principal: env.caller,
            phone_number: PhoneNumber::from_str("+44 1111 111 111").unwrap(),
            user_id: Principal::from_slice(&[1]).into(),
            username: "abc".to_string(),
            date_created: env.now,
            date_updated: env.now,
            last_online: env.now,
            upgrade_in_progress: false,
            wasm_version: Version::new(0, 0, 0),
        }));
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            username: "a a".to_string(),
        };
        let result = set_username_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::UsernameInvalid));
    }

    #[test]
    fn username_too_short() {
        let env = TestEnv::default();
        let mut data = Data::default();
        data.users.add(User::Created(CreatedUser {
            principal: env.caller,
            phone_number: PhoneNumber::from_str("+44 1111 111 111").unwrap(),
            user_id: Principal::from_slice(&[1]).into(),
            username: "abc".to_string(),
            date_created: env.now,
            date_updated: env.now,
            last_online: env.now,
            upgrade_in_progress: false,
            wasm_version: Version::new(0, 0, 0),
        }));
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            username: "a".to_string(),
        };
        let result = set_username_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::UsernameTooShort(2)));
    }

    #[test]
    fn username_too_long() {
        let env = TestEnv::default();
        let mut data = Data::default();
        data.users.add(User::Created(CreatedUser {
            principal: env.caller,
            phone_number: PhoneNumber::from_str("+44 1111 111 111").unwrap(),
            user_id: Principal::from_slice(&[1]).into(),
            username: "abc".to_string(),
            date_created: env.now,
            date_updated: env.now,
            last_online: env.now,
            upgrade_in_progress: false,
            wasm_version: Version::new(0, 0, 0),
        }));
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            username: "abcdefghijklmnopqrstuvwxyz".to_string(),
        };
        let result = set_username_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::UsernameTooLong(25)));
    }
}
