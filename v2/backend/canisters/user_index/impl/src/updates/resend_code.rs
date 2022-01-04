use crate::model::user::{UnconfirmedPhoneNumber, UnconfirmedUserState, User};
use crate::{mutate_state, RuntimeState, CONFIRMATION_CODE_EXPIRY_MILLIS};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use types::ConfirmationCodeSms;
use user_index_canister::resend_code::{Response::*, *};

#[update]
#[trace]
fn resend_code(_args: Args) -> Response {
    mutate_state(resend_code_impl)
}

fn resend_code_impl(runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();

    if let Some(user) = runtime_state.data.users.get_by_principal(&caller).cloned() {
        match &user {
            User::Unconfirmed(u) => {
                if let UnconfirmedUserState::PhoneNumber(p) = &u.state {
                    let now = runtime_state.env.now();
                    let confirmation_code = runtime_state.generate_6_digit_code();

                    let mut clone = u.clone();
                    clone.state = UnconfirmedUserState::PhoneNumber(UnconfirmedPhoneNumber {
                        phone_number: p.phone_number.clone(),
                        confirmation_code: confirmation_code.clone(),
                        valid_until: now + CONFIRMATION_CODE_EXPIRY_MILLIS,
                        sms_messages_sent: p.sms_messages_sent + 1,
                    });
                    runtime_state.data.users.update(User::Unconfirmed(clone));

                    let sms = ConfirmationCodeSms {
                        phone_number: p.phone_number.to_string(),
                        confirmation_code,
                    };
                    runtime_state.data.sms_messages.add(sms);
                    Success
                } else {
                    PhoneNumberNotSubmitted
                }
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
    use crate::model::user::{ConfirmedUser, UnconfirmedPhoneNumber, UnconfirmedUser};
    use crate::Data;
    use types::PhoneNumber;
    use utils::env::test::TestEnv;

    #[test]
    fn unconfirmed_user_succeeds() {
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

        let result = resend_code_impl(&mut runtime_state);
        assert!(matches!(result, Response::Success));
        assert_eq!(runtime_state.data.sms_messages.len(), 1);
    }

    #[test]
    fn confirmed_user_returns_already_claimed() {
        let env = TestEnv::default();
        let mut data = Data::default();
        data.users.add_test_user(User::Confirmed(ConfirmedUser {
            principal: env.caller,
            phone_number: Some(PhoneNumber::new(44, "1111 111 111".to_owned())),
            date_confirmed: env.now,
            ..Default::default()
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
