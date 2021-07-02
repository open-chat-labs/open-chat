use crate::model::data::append_sms_to_queue;
use crate::model::runtime_state::RuntimeState;
use crate::model::user::User;
use candid::CandidType;
use serde::Deserialize;

pub fn update(runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();

    if let Some(user) = runtime_state.data.users.get_by_principal(&caller) {
        match user {
            User::Unconfirmed(u) => {
                append_sms_to_queue(
                    &mut runtime_state.data.sms_queue,
                    u.phone_number.clone(),
                    u.confirmation_code.to_string(),
                );
                Response::Success
            }
            _ => Response::AlreadyClaimed,
        }
    } else {
        Response::UserNotFound
    }
}

#[derive(Deserialize)]
pub struct Request {}

#[derive(CandidType)]
pub enum Response {
    Success,
    AlreadyClaimed,
    UserNotFound,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::data::Data;
    use crate::model::runtime_state::RuntimeState;
    use crate::model::user::{CanisterCreationStatus, ConfirmedUser, UnconfirmedUser};
    use crate::test::env::TestEnv;
    use phonenumber::PhoneNumber;
    use std::str::FromStr;

    #[test]
    fn unconfirmed_user_succeeds() {
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

        let result = update(&mut runtime_state);
        assert!(matches!(result, Response::Success));
        assert_eq!(runtime_state.data.sms_queue.len(), 1);
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

        let result = update(&mut runtime_state);
        assert!(matches!(result, Response::AlreadyClaimed));
    }

    #[test]
    fn no_user_returns_user_not_found() {
        let env = TestEnv::default();
        let data = Data::default();
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let result = update(&mut runtime_state);
        assert!(matches!(result, Response::UserNotFound));
    }
}
