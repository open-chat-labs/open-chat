use crate::model::data::CONFIRMATION_CODE_EXPIRY_MILLIS;
use crate::model::runtime_state::RuntimeState;
use crate::model::user::{CanisterCreationStatus, ConfirmedUser, User};
use candid::CandidType;
use phonenumber::PhoneNumber;
use serde::Deserialize;

pub fn update(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let now = runtime_state.env.now();

    let phone_number: PhoneNumber;
    if let Some(user) = runtime_state.data.users.get_by_principal(&caller) {
        match user {
            User::Unconfirmed(u) => {
                let code_expires_at = u.date_generated + CONFIRMATION_CODE_EXPIRY_MILLIS;
                let has_code_expired = now > code_expires_at;
                if has_code_expired {
                    return Response::ConfirmationCodeExpired;
                } else if args.confirmation_code != u.confirmation_code {
                    return Response::ConfirmationCodeIncorrect;
                } else {
                    phone_number = u.phone_number.clone();
                }
            }
            _ => return Response::AlreadyClaimed,
        }
    } else {
        return Response::UserNotFound;
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

    Response::Success
}

#[derive(Deserialize)]
pub struct Args {
    confirmation_code: String,
}

#[derive(CandidType)]
pub enum Response {
    Success,
    ConfirmationCodeIncorrect,
    ConfirmationCodeExpired,
    AlreadyClaimed,
    UserNotFound,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::data::Data;
    use crate::model::runtime_state::RuntimeState;
    use crate::model::user::UnconfirmedUser;
    use crate::test::env::TestEnv;
    use std::str::FromStr;

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
        let result = update(args, &mut runtime_state);
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
        let result = update(args, &mut runtime_state);
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
        let result = update(args, &mut runtime_state);
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
        let result = update(args, &mut runtime_state);
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
        let result = update(args, &mut runtime_state);
        assert!(matches!(result, Response::UserNotFound));
    }
}
