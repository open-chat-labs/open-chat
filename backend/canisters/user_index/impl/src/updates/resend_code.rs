use crate::model::user::{PhoneStatus, UnconfirmedPhoneNumber};
use crate::{mutate_state, RuntimeState, CONFIRMATION_CODE_EXPIRY_MILLIS};
use canister_tracing_macros::trace;
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

    if let Some(mut user) = runtime_state.data.users.get_by_principal(&caller).cloned() {
        match user.phone_status {
            PhoneStatus::Unconfirmed(p) => {
                let now = runtime_state.env.now();
                let confirmation_code = runtime_state.generate_6_digit_code();

                user.phone_status = PhoneStatus::Unconfirmed(UnconfirmedPhoneNumber {
                    phone_number: p.phone_number.clone(),
                    confirmation_code: confirmation_code.clone(),
                    valid_until: now + CONFIRMATION_CODE_EXPIRY_MILLIS,
                    sms_messages_sent: p.sms_messages_sent + 1,
                });

                let sms = ConfirmationCodeSms {
                    phone_number: p.phone_number.to_string(),
                    confirmation_code,
                };
                runtime_state.data.sms_messages.add(sms);
                Success
            }
            PhoneStatus::Confirmed(_) => PhoneNumberAlreadyConfirmed,
            PhoneStatus::None => PhoneNumberNotSubmitted,
        }
    } else {
        UserNotFound
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::user::{UnconfirmedPhoneNumber, User};
    use crate::Data;
    use types::PhoneNumber;
    use utils::env::test::TestEnv;

    #[test]
    fn created_user_succeeds() {
        let env = TestEnv::default();
        let mut data = Data::default();
        data.users.add_test_user(User {
            principal: env.caller,
            phone_status: PhoneStatus::Unconfirmed(UnconfirmedPhoneNumber {
                phone_number: PhoneNumber::new(44, "1111 111 111".to_owned()),
                confirmation_code: "123456".to_string(),
                valid_until: env.now + 1000,
                sms_messages_sent: 1,
            }),
            ..Default::default()
        });
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let result = resend_code_impl(&mut runtime_state);
        assert!(matches!(result, Response::Success));
        assert_eq!(runtime_state.data.sms_messages.len(), 1);
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
