use crate::model::user::{CreatedUser, PhoneStatus, User};
use crate::model::user_map::UpdateUserResult;
use crate::updates::storage_byte_limit_for_new_user;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use open_storage_index_canister::add_or_update_users::UserConfig;
use types::{CanisterCreationStatusInternal, CyclesTopUp};
use user_index_canister::set_username::{Response::*, *};

const MAX_USERNAME_LENGTH: u16 = 25;
const MIN_USERNAME_LENGTH: u16 = 3;

#[update]
#[trace]
fn set_username(args: Args) -> Response {
    mutate_state(|state| set_username_impl(args, state))
}

fn set_username_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let now = runtime_state.env.now();

    runtime_state.data.users.mark_online(&caller, now);

    let username = args.username;

    match validate_username(&username) {
        UsernameValidationResult::TooShort(min_length) => return UsernameTooShort(min_length),
        UsernameValidationResult::TooLong(max_length) => return UsernameTooLong(max_length),
        UsernameValidationResult::Invalid => return UsernameInvalid,
        _ => {}
    };

    if let Some(user) = runtime_state.data.users.get_by_principal(&caller) {
        let user_to_update = match user {
            User::Unconfirmed(_) => {
                return UserUnconfirmed;
            }
            User::Confirmed(user) => {
                if let CanisterCreationStatusInternal::Created(canister_id, wasm_version, cycles) =
                    &user.canister_creation_status
                {
                    let phone_status = match &user.phone_number {
                        Some(pn) => PhoneStatus::Confirmed(pn.clone()),
                        None => PhoneStatus::None,
                    };
                    let open_storage_limit_bytes = storage_byte_limit_for_new_user(&phone_status, &user.registration_fee);

                    let created_user = CreatedUser {
                        principal: caller,
                        user_id: (*canister_id).into(),
                        username,
                        date_created: now,
                        date_updated: now,
                        last_online: now,
                        wasm_version: *wasm_version,
                        upgrade_in_progress: user.upgrade_in_progress,
                        cycle_top_ups: vec![CyclesTopUp {
                            amount: *cycles,
                            date: now,
                        }],
                        avatar_id: None,
                        registration_fee: user.registration_fee.clone(),
                        open_storage_limit_bytes,
                        phone_status,
                    };

                    if open_storage_limit_bytes > 0 {
                        runtime_state.data.open_storage_user_sync_queue.push(UserConfig {
                            user_id: caller,
                            byte_limit: open_storage_limit_bytes,
                        });
                    }

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
                user.date_updated = now;
                User::Created(user)
            }
        };
        match runtime_state.data.users.update(user_to_update) {
            UpdateUserResult::Success => Success,
            UpdateUserResult::UsernameTaken => UsernameTaken,
            UpdateUserResult::UserNotFound => UserNotFound,
            result => panic!("Unexpected result returned when updating username: {result:?}"),
        }
    } else {
        UserNotFound
    }
}

pub enum UsernameValidationResult {
    Ok,
    TooLong(u16),
    TooShort(u16),
    Invalid,
}

pub fn validate_username(username: &str) -> UsernameValidationResult {
    if username.len() > MAX_USERNAME_LENGTH as usize {
        return UsernameValidationResult::TooLong(MAX_USERNAME_LENGTH);
    }

    if username.len() < MIN_USERNAME_LENGTH as usize {
        return UsernameValidationResult::TooShort(MIN_USERNAME_LENGTH);
    }

    if username.starts_with('_') || username.ends_with('_') || username.contains("__") {
        return UsernameValidationResult::Invalid;
    }

    if username.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
        UsernameValidationResult::Ok
    } else {
        UsernameValidationResult::Invalid
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::user::{CreatedUser, PhoneStatus, UnconfirmedPhoneNumber, UnconfirmedUser, UnconfirmedUserState, User};
    use crate::Data;
    use candid::Principal;
    use types::PhoneNumber;
    use utils::env::test::TestEnv;

    #[test]
    fn valid_username_succeeds() {
        let env = TestEnv::default();
        let mut data = Data::default();
        data.users.add_test_user(User::Created(CreatedUser {
            principal: env.caller,
            phone_status: PhoneStatus::Confirmed(PhoneNumber::new(44, "1111 111 111".to_owned())),
            user_id: Principal::from_slice(&[1]).into(),
            username: "abc".to_string(),
            date_created: env.now,
            date_updated: env.now,
            last_online: env.now,
            ..Default::default()
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
        data.users.add_test_user(User::Created(CreatedUser {
            principal: env.caller,
            phone_status: PhoneStatus::Confirmed(PhoneNumber::new(44, "1111 111 111".to_owned())),
            user_id: Principal::from_slice(&[1]).into(),
            username: "abc".to_string(),
            date_created: env.now,
            date_updated: env.now,
            last_online: env.now,
            ..Default::default()
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
        data.users.add_test_user(User::Created(CreatedUser {
            principal: Principal::from_slice(&[1]),
            phone_status: PhoneStatus::Confirmed(PhoneNumber::new(44, "1111 111 111".to_owned())),
            user_id: Principal::from_slice(&[1]).into(),
            username: "abc".to_string(),
            date_created: env.now,
            date_updated: env.now,
            last_online: env.now,
            ..Default::default()
        }));
        data.users.add_test_user(User::Created(CreatedUser {
            principal: Principal::from_slice(&[2]),
            phone_status: PhoneStatus::Confirmed(PhoneNumber::new(44, "2222 222 222".to_owned())),
            user_id: Principal::from_slice(&[2]).into(),
            username: "xyz".to_string(),
            date_created: env.now,
            date_updated: env.now,
            last_online: env.now,
            ..Default::default()
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
        data.users.add(UnconfirmedUser {
            principal: env.caller,
            state: UnconfirmedUserState::PhoneNumber(UnconfirmedPhoneNumber {
                phone_number: PhoneNumber::new(44, "1111 111 111".to_owned()),
                confirmation_code: "123456".to_string(),
                valid_until: env.now + 1000,
                sms_messages_sent: 1,
            }),
        });
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
        data.users.add_test_user(User::Created(CreatedUser {
            principal: env.caller,
            phone_status: PhoneStatus::Confirmed(PhoneNumber::new(44, "1111 111 111".to_owned())),
            user_id: Principal::from_slice(&[1]).into(),
            username: "abc".to_string(),
            date_created: env.now,
            date_updated: env.now,
            last_online: env.now,
            ..Default::default()
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
        data.users.add_test_user(User::Created(CreatedUser {
            principal: env.caller,
            phone_status: PhoneStatus::Confirmed(PhoneNumber::new(44, "1111 111 111".to_owned())),
            user_id: Principal::from_slice(&[1]).into(),
            username: "abc".to_string(),
            date_created: env.now,
            date_updated: env.now,
            last_online: env.now,
            ..Default::default()
        }));
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            username: "ab".to_string(),
        };
        let result = set_username_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::UsernameTooShort(3)));
    }

    #[test]
    fn username_too_long() {
        let env = TestEnv::default();
        let mut data = Data::default();
        data.users.add_test_user(User::Created(CreatedUser {
            principal: env.caller,
            phone_status: PhoneStatus::Confirmed(PhoneNumber::new(44, "1111 111 111".to_owned())),
            user_id: Principal::from_slice(&[1]).into(),
            username: "abc".to_string(),
            date_created: env.now,
            date_updated: env.now,
            last_online: env.now,
            ..Default::default()
        }));
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            username: "abcdefghijklmnopqrstuvwxyz".to_string(),
        };
        let result = set_username_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::UsernameTooLong(25)));
    }

    #[test]
    fn valid_usernames() {
        assert!(matches!(validate_username("abc"), UsernameValidationResult::Ok));
        assert!(matches!(validate_username("123"), UsernameValidationResult::Ok));
        assert!(matches!(
            validate_username("1_2_3_4_5_6_7_8_9_0_1_2_3"),
            UsernameValidationResult::Ok
        ));
    }

    #[test]
    fn invalid_usernames() {
        assert!(matches!(validate_username("abc "), UsernameValidationResult::Invalid));
        assert!(matches!(validate_username("ab c"), UsernameValidationResult::Invalid));
        assert!(matches!(validate_username("_abc"), UsernameValidationResult::Invalid));
        assert!(matches!(validate_username("abc_"), UsernameValidationResult::Invalid));
        assert!(matches!(validate_username("ab__c"), UsernameValidationResult::Invalid));
        assert!(matches!(validate_username("ab,c"), UsernameValidationResult::Invalid));
        assert!(matches!(validate_username("abcé"), UsernameValidationResult::Invalid));
        assert!(matches!(validate_username("abcṷ"), UsernameValidationResult::Invalid));
        assert!(matches!(validate_username("abc王"), UsernameValidationResult::Invalid));
    }
}
