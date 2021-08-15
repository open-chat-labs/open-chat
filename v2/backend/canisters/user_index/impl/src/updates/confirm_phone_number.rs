use crate::{RuntimeState, CONFIRMATION_CODE_EXPIRY_MILLIS, RUNTIME_STATE};
use ic_cdk_macros::update;
use phonenumber::PhoneNumber;
use types::user::{CanisterCreationStatus, ConfirmedUser, User};
use user_index_canister::updates::confirm_phone_number::{Response::*, *};

#[update]
fn confirm_phone_number(args: Args) -> Response {
    RUNTIME_STATE.with(|state| confirm_phone_number_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn confirm_phone_number_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let now = runtime_state.env.now();
    let test_mode = runtime_state.env.test_mode();

    let phone_number: PhoneNumber;
    if let Some(user) = runtime_state.data.users.get_by_principal(&caller) {
        match user {
            User::Unconfirmed(u) => {
                let code_expires_at = u.date_generated + CONFIRMATION_CODE_EXPIRY_MILLIS;
                let has_code_expired = now > code_expires_at;
                if has_code_expired {
                    return ConfirmationCodeExpired;
                } else if (args.confirmation_code == u.confirmation_code) || (test_mode && args.confirmation_code == "123456") {
                    phone_number = u.phone_number.clone();
                } else {
                    return ConfirmationCodeIncorrect;
                }
            }
            _ => return AlreadyClaimed,
        }
    } else {
        return UserNotFound;
    }

    let user = ConfirmedUser {
        principal: caller,
        phone_number,
        user_id: None,
        username: None,
        date_confirmed: now,
        canister_creation_status: CanisterCreationStatus::Pending,
    };
    runtime_state.data.users.update(User::Confirmed(user));

    Success
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Data;
    use shared::env::test::TestEnv;
    use std::str::FromStr;
    use types::user::UnconfirmedUser;

    #[test]
    fn correct_code_succeeds() {
        let env = TestEnv::default();
        let confirmation_code = "123456".to_string();
        let mut data = Data::default();
        data.users.add(User::Unconfirmed(UnconfirmedUser {
            principal: env.caller,
            phone_number: PhoneNumber::from_str("+44 1111 111 111").unwrap(),
            confirmation_code: confirmation_code.clone(),
            date_generated: env.now,
            sms_messages_sent: 1,
        }));
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let args = Args { confirmation_code };
        let result = confirm_phone_number_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::Success));

        let user = runtime_state
            .data
            .users
            .get_by_principal(&runtime_state.env.caller())
            .unwrap();
        assert!(matches!(user, User::Confirmed(_)));
    }

    #[test]
    fn incorrect_code_returns_confirmation_code_incorrect() {
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
            confirmation_code: "123457".to_string(),
        };
        let result = confirm_phone_number_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::ConfirmationCodeIncorrect));
    }

    #[test]
    fn code_expired_returns_confirmation_code_expired() {
        let confirmation_code = "123456".to_string();
        let mut env = TestEnv::default();
        let mut data = Data::default();
        data.users.add(User::Unconfirmed(UnconfirmedUser {
            principal: env.caller,
            phone_number: PhoneNumber::from_str("+44 1111 111 111").unwrap(),
            confirmation_code: confirmation_code.clone(),
            date_generated: env.now,
            sms_messages_sent: 1,
        }));
        env.now += CONFIRMATION_CODE_EXPIRY_MILLIS + 1;
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let args = Args { confirmation_code };
        let result = confirm_phone_number_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::ConfirmationCodeExpired));
    }

    #[test]
    fn confirmed_user_returns_already_claimed() {
        let env = TestEnv::default();
        let mut data = Data::default();
        data.users.add(User::Confirmed(ConfirmedUser {
            principal: env.caller,
            phone_number: PhoneNumber::from_str("+44 1111 111 111").unwrap(),
            user_id: None,
            username: None,
            canister_creation_status: CanisterCreationStatus::Pending,
            date_confirmed: env.now,
        }));
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            confirmation_code: "123456".to_string(),
        };
        let result = confirm_phone_number_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::AlreadyClaimed));
    }

    #[test]
    fn no_user_returns_user_not_found() {
        let env = TestEnv::default();
        let data = Data::default();
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            confirmation_code: "123456".to_string(),
        };
        let result = confirm_phone_number_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::UserNotFound));
    }
}
