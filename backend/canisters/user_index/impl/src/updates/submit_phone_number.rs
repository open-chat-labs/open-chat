use crate::model::user_map::SubmitPhoneNumberResult;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use types::ConfirmationCodeSms;
use user_index_canister::submit_phone_number::{Response::*, *};

#[update]
#[trace]
fn submit_phone_number(args: Args) -> Response {
    mutate_state(|state| submit_phone_number_impl(args, state))
}

fn submit_phone_number_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let now = runtime_state.env.now();
    let mut phone_number = args.phone_number;
    phone_number.prune_whitespace();

    if !phone_number.is_valid() {
        return InvalidPhoneNumber;
    }

    let confirmation_code = runtime_state.generate_6_digit_code();
    let phone_number_string = phone_number.to_string();

    match runtime_state
        .data
        .users
        .submit_phone_number(caller, phone_number, confirmation_code.clone(), now)
    {
        SubmitPhoneNumberResult::Success => {
            let sms = ConfirmationCodeSms {
                phone_number: phone_number_string,
                confirmation_code,
            };
            runtime_state.data.sms_messages.add(sms);
            Success
        }
        SubmitPhoneNumberResult::PhoneNumberTaken => AlreadyRegisteredByOther,
        SubmitPhoneNumberResult::AlreadyConfirmed => AlreadyRegistered,
        SubmitPhoneNumberResult::UserNotFound => UserNotFound,
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
    fn phone_number_added_successfully() {
        let env = TestEnv::default();
        let mut data = Data::default();
        let principal = Principal::from_slice(&[1]);
        let phone_number = PhoneNumber::new(44, "1111 111 111".to_string());

        data.users.add_test_user(User {
            principal,
            user_id: Principal::from_slice(&[1, 1]).into(),
            username: "1".to_string(),
            ..Default::default()
        });
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            phone_number: phone_number.clone(),
        };
        let result = submit_phone_number_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::Success));
        let user = runtime_state.data.users.get_by_principal(&principal).unwrap();
        assert_eq!(*user.phone_status.phone_number().unwrap(), phone_number);
    }

    #[test]
    fn already_registered_by_other() {
        let env = TestEnv::default();
        let mut data = Data::default();
        data.users.add_test_user(User {
            principal: Principal::from_slice(&[1]),
            user_id: Principal::from_slice(&[1, 1]).into(),
            username: "1".to_string(),
            ..Default::default()
        });

        data.users.add_test_user(User {
            principal: Principal::from_slice(&[2]),
            user_id: Principal::from_slice(&[2, 2]).into(),
            username: "2".to_string(),
            phone_status: PhoneStatus::Confirmed(PhoneNumber::new(44, "1111 111 111".to_owned())),
            ..Default::default()
        });
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            phone_number: PhoneNumber::new(44, "1111 111 111".to_owned()),
        };
        let result = submit_phone_number_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::AlreadyRegisteredByOther));
    }

    #[test]
    fn invalid_phone_number() {
        let env = TestEnv::default();
        let mut runtime_state = RuntimeState::new(Box::new(env), Data::default());

        let args = Args {
            phone_number: PhoneNumber::new(44, "_".to_owned()),
        };
        let result = submit_phone_number_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::InvalidPhoneNumber));
    }
}
