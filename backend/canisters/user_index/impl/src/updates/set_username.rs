use crate::guards::caller_is_openchat_user;
use crate::model::user_map::UpdateUserResult;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use local_user_index_canister::{Event, UsernameChanged};
use user_index_canister::set_username::{Response::*, *};

const MAX_USERNAME_LENGTH: u16 = 25;
const MIN_USERNAME_LENGTH: u16 = 5;

#[update(guard = "caller_is_openchat_user")]
#[trace]
fn set_username(args: Args) -> Response {
    mutate_state(|state| set_username_impl(args, state))
}

fn set_username_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let username = args.username;

    match validate_username(&username) {
        UsernameValidationResult::TooShort(min_length) => return UsernameTooShort(min_length),
        UsernameValidationResult::TooLong(max_length) => return UsernameTooLong(max_length),
        UsernameValidationResult::Invalid => return UsernameInvalid,
        _ => {}
    };

    if let Some(user) = runtime_state.data.users.get_by_principal(&caller) {
        let mut user_to_update = user.clone();
        user_to_update.username = username.clone();
        let user_id = user.user_id;
        let now = runtime_state.env.now();
        match runtime_state.data.users.update(user_to_update, now) {
            UpdateUserResult::Success => {
                runtime_state
                    .push_event_to_local_user_index(user_id, Event::UsernameChanged(UsernameChanged { user_id, username }));

                Success
            }
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

    if username.starts_with('_')
        || username.ends_with('_')
        || username.contains("__")
        || !username.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
        || is_username_reserved(username)
    {
        return UsernameValidationResult::Invalid;
    }

    UsernameValidationResult::Ok
}

fn is_username_reserved(username: &str) -> bool {
    let normalised = username.replace('_', "").to_uppercase();
    let is_bot_like = normalised.ends_with("BOT") || normalised.ends_with("B0T");

    if is_bot_like {
        if normalised == "OPENCHATBOT" {
            return true;
        }
        if normalised.starts_with("SNS") {
            return true;
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::user::{PhoneStatus, User};
    use crate::Data;
    use candid::Principal;
    use types::PhoneNumber;
    use utils::env::test::TestEnv;

    #[test]
    fn valid_username_succeeds() {
        let env = TestEnv::default();
        let mut data = Data::default();
        data.users.add_test_user(User {
            principal: env.caller,
            phone_status: PhoneStatus::Confirmed(PhoneNumber::new(44, "1111 111 111".to_owned())),
            user_id: Principal::from_slice(&[1]).into(),
            username: "abcdef".to_string(),
            date_created: env.now,
            date_updated: env.now,
            ..Default::default()
        });
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            username: "vwxyz".to_string(),
        };
        let result = set_username_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::Success));

        let user = runtime_state.data.users.get_by_username("vwxyz").unwrap();

        assert_eq!(&user.username, "vwxyz");
    }

    #[test]
    fn no_change_to_username_succeeds() {
        let env = TestEnv::default();
        let mut data = Data::default();
        data.users.add_test_user(User {
            principal: env.caller,
            phone_status: PhoneStatus::Confirmed(PhoneNumber::new(44, "1111 111 111".to_owned())),
            user_id: Principal::from_slice(&[1]).into(),
            username: "abcdef".to_string(),
            date_created: env.now,
            date_updated: env.now,
            ..Default::default()
        });
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            username: "abcdef".to_string(),
        };
        let result = set_username_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::Success));
    }

    #[test]
    fn username_taken() {
        let env = TestEnv::default();
        let mut data = Data::default();
        data.users.add_test_user(User {
            principal: Principal::from_slice(&[1]),
            phone_status: PhoneStatus::Confirmed(PhoneNumber::new(44, "1111 111 111".to_owned())),
            user_id: Principal::from_slice(&[1]).into(),
            username: "abcdef".to_string(),
            date_created: env.now,
            date_updated: env.now,
            ..Default::default()
        });
        data.users.add_test_user(User {
            principal: Principal::from_slice(&[2]),
            phone_status: PhoneStatus::Confirmed(PhoneNumber::new(44, "2222 222 222".to_owned())),
            user_id: Principal::from_slice(&[2]).into(),
            username: "vwxyz".to_string(),
            date_created: env.now,
            date_updated: env.now,
            ..Default::default()
        });
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            username: "vwxyz".to_string(),
        };
        let result = set_username_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::UsernameTaken));
    }

    #[test]
    fn invalid_username() {
        let env = TestEnv::default();
        let mut data = Data::default();
        data.users.add_test_user(User {
            principal: env.caller,
            phone_status: PhoneStatus::Confirmed(PhoneNumber::new(44, "1111 111 111".to_owned())),
            user_id: Principal::from_slice(&[1]).into(),
            username: "abcde".to_string(),
            date_created: env.now,
            date_updated: env.now,
            ..Default::default()
        });
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            username: "ab ab".to_string(),
        };
        let result = set_username_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::UsernameInvalid));
    }

    #[test]
    fn username_too_short() {
        let env = TestEnv::default();
        let mut data = Data::default();
        data.users.add_test_user(User {
            principal: env.caller,
            phone_status: PhoneStatus::Confirmed(PhoneNumber::new(44, "1111 111 111".to_owned())),
            user_id: Principal::from_slice(&[1]).into(),
            username: "abcde".to_string(),
            date_created: env.now,
            date_updated: env.now,
            ..Default::default()
        });
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            username: "abcd".to_string(),
        };
        let result = set_username_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::UsernameTooShort(MIN_USERNAME_LENGTH)));
    }

    #[test]
    fn username_too_long() {
        let env = TestEnv::default();
        let mut data = Data::default();
        data.users.add_test_user(User {
            principal: env.caller,
            phone_status: PhoneStatus::Confirmed(PhoneNumber::new(44, "1111 111 111".to_owned())),
            user_id: Principal::from_slice(&[1]).into(),
            username: "abcde".to_string(),
            date_created: env.now,
            date_updated: env.now,
            ..Default::default()
        });
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            username: "abcdefghijklmnopqrstuvwxyz".to_string(),
        };
        let result = set_username_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::UsernameTooLong(MAX_USERNAME_LENGTH)));
    }

    #[test]
    fn valid_usernames() {
        assert!(matches!(validate_username("abcde"), UsernameValidationResult::Ok));
        assert!(matches!(validate_username("12345"), UsernameValidationResult::Ok));
        assert!(matches!(validate_username("SNSABC"), UsernameValidationResult::Ok));
        assert!(matches!(
            validate_username("1_2_3_4_5_6_7_8_9_0_1_2_3"),
            UsernameValidationResult::Ok
        ));
    }

    #[test]
    fn invalid_usernames() {
        assert!(matches!(validate_username("abcde "), UsernameValidationResult::Invalid));
        assert!(matches!(validate_username("ab cde"), UsernameValidationResult::Invalid));
        assert!(matches!(validate_username("_abcde"), UsernameValidationResult::Invalid));
        assert!(matches!(validate_username("abcde_"), UsernameValidationResult::Invalid));
        assert!(matches!(validate_username("ab__cde"), UsernameValidationResult::Invalid));
        assert!(matches!(validate_username("ab,cde"), UsernameValidationResult::Invalid));
        assert!(matches!(validate_username("abcéd"), UsernameValidationResult::Invalid));
        assert!(matches!(validate_username("abcṷd"), UsernameValidationResult::Invalid));
        assert!(matches!(validate_username("abc王d"), UsernameValidationResult::Invalid));
        assert!(matches!(validate_username("OpenChat_Bot"), UsernameValidationResult::Invalid));
        assert!(matches!(validate_username("SNS1Bot"), UsernameValidationResult::Invalid));
        assert!(matches!(validate_username("SNS2_B0T"), UsernameValidationResult::Invalid));
    }
}
