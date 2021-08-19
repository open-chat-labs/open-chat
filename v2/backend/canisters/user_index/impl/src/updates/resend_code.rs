use crate::model::user::User;
use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use types::ConfirmationCodeSms;
use user_index_canister::resend_code::{Response::*, *};

#[update]
fn resend_code(_: Args) -> Response {
    RUNTIME_STATE.with(|state| resend_code_impl(state.borrow_mut().as_mut().unwrap()))
}

fn resend_code_impl(runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();

    if let Some(user) = runtime_state.data.users.get_by_principal(&caller) {
        match user {
            User::Unconfirmed(u) => {
                let sms = ConfirmationCodeSms {
                    phone_number: u.phone_number.to_string(),
                    confirmation_code: u.confirmation_code.to_string(),
                };
                runtime_state.data.sms_messages.add(sms);
                Success
            }
            _ => AlreadyClaimed,
        }
    } else {
        UserNotFound
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::user::{ConfirmedUser, UnconfirmedUser};
    use crate::Data;
    use phonenumber::PhoneNumber;
    use std::str::FromStr;
    use types::CanisterCreationStatus;
    use utils::env::test::TestEnv;

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

        let result = resend_code_impl(&mut runtime_state);
        assert!(matches!(result, Response::Success));
        assert_eq!(runtime_state.data.sms_messages.len(), 1);
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

        let result = resend_code_impl(&mut runtime_state);
        assert!(matches!(result, Response::AlreadyClaimed));
    }

    #[test]
    fn no_user_returns_user_not_found() {
        let env = TestEnv::default();
        let data = Data::default();
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let result = resend_code_impl(&mut runtime_state);
        assert!(matches!(result, Response::UserNotFound));
    }
}
