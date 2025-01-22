use crate::guards::caller_is_openchat_user;
use crate::model::user_map::UpdateUserResult;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::{UserIndexEvent, UsernameChanged};
use user_index_canister::set_username::{Response::*, *};
use utils::text_validation::{validate_username, UsernameValidationError};

#[update(guard = "caller_is_openchat_user", msgpack = true)]
#[trace]
fn set_username(args: Args) -> Response {
    mutate_state(|state| set_username_impl(args, state))
}

fn set_username_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();

    if let Some(user) = state.data.users.get_by_principal(&caller) {
        let username = args.username;
        if !username.eq_ignore_ascii_case(&user.username) {
            match validate_username(&username) {
                Ok(_) => {}
                Err(UsernameValidationError::TooShort(s)) => return UsernameTooShort(s.min_length as u16),
                Err(UsernameValidationError::TooLong(l)) => return UsernameTooLong(l.max_length as u16),
                Err(UsernameValidationError::Invalid) => return UsernameInvalid,
            };
        }

        let mut user_to_update = user.clone();
        user_to_update.username.clone_from(&username);
        let user_id = user.user_id;
        let now = state.env.now();
        match state.data.users.update(user_to_update, now, false, None) {
            UpdateUserResult::Success => {
                state.push_event_to_local_user_index(
                    user_id,
                    UserIndexEvent::UsernameChanged(UsernameChanged { user_id, username }),
                );

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
        let mut state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            username: "vwxyz".to_string(),
        };
        let result = set_username_impl(args, &mut state);
        assert!(matches!(result, Response::Success));

        let user = state.data.users.get_by_username("vwxyz").unwrap();

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
        let mut state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            username: "abcdef".to_string(),
        };
        let result = set_username_impl(args, &mut state);
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
        let mut state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            username: "vwxyz".to_string(),
        };
        let result = set_username_impl(args, &mut state);
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
        let mut state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            username: "ab ab".to_string(),
        };
        let result = set_username_impl(args, &mut state);
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
        let mut state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            username: "abcd".to_string(),
        };
        let result = set_username_impl(args, &mut state);
        assert!(matches!(result, Response::UsernameTooShort(_)));
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
        let mut state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            username: "abcdefghijklmnopqrstuvwxyz".to_string(),
        };
        let result = set_username_impl(args, &mut state);
        assert!(matches!(result, Response::UsernameTooLong(_)));
    }
}
