use crate::model::user_map::SubmitPhoneNumberResult;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::trace;
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
        .submit_phone_number(caller, phone_number, &confirmation_code, now)
    {
        SubmitPhoneNumberResult::Success => {
            let sms = ConfirmationCodeSms {
                phone_number: phone_number_string,
                confirmation_code,
            };
            runtime_state.data.sms_messages.add(sms);
            Success
        }
        SubmitPhoneNumberResult::AlreadyTaken => AlreadyRegisteredByOther,
        SubmitPhoneNumberResult::AlreadyConfirmed => AlreadyRegistered,
        SubmitPhoneNumberResult::UserLimitReached => UserLimitReached,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::user::{ConfirmedUser, User};
    use crate::Data;
    use candid::Principal;
    use types::PhoneNumber;
    use utils::env::test::TestEnv;

    #[test]
    fn new_user_succeeds() {
        let env = TestEnv::default();
        let mut runtime_state = RuntimeState::new(Box::new(env), Data::default());

        let args = Args {
            phone_number: PhoneNumber::new(44, "1111 111 111".to_owned()),
        };
        let result = submit_phone_number_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::Success));

        let user = runtime_state
            .data
            .users
            .get_by_principal(&runtime_state.env.caller())
            .unwrap();
        assert!(matches!(user, User::Unconfirmed(_)));
    }

    #[test]
    fn existing_unconfirmed_user_succeeds() {
        let env = TestEnv::default();
        let mut runtime_state = RuntimeState::new(Box::new(env), Data::default());

        let args1 = Args {
            phone_number: PhoneNumber::new(44, "2222 222 222".to_owned()),
        };
        let result1 = submit_phone_number_impl(args1, &mut runtime_state);
        assert!(matches!(result1, Response::Success));

        let args2 = Args {
            phone_number: PhoneNumber::new(44, "2222 222 222".to_owned()),
        };
        let result2 = submit_phone_number_impl(args2, &mut runtime_state);
        assert!(matches!(result2, Response::Success));

        let user = runtime_state
            .data
            .users
            .get_by_principal(&runtime_state.env.caller())
            .unwrap();
        assert!(matches!(user, User::Unconfirmed(_)));
        assert_eq!(user.get_phone_number().unwrap().to_string(), "+44 2222222222");
    }

    #[test]
    fn existing_confirmed_user_returns_already_registered() {
        let env = Box::new(TestEnv::default());
        let mut data = Data::default();
        data.users.add_test_user(User::Confirmed(ConfirmedUser {
            principal: env.caller,
            phone_number: Some(PhoneNumber::new(44, "1111 111 111".to_owned())),
            date_confirmed: env.now,
            ..Default::default()
        }));
        let mut runtime_state = RuntimeState::new(env, data);

        let args = Args {
            phone_number: PhoneNumber::new(44, "2222 222 222".to_owned()),
        };
        let result = submit_phone_number_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::AlreadyRegistered));
    }

    #[test]
    fn phone_number_taken_returns_already_taken_by_other() {
        let env = TestEnv::default();
        let mut data = Data::default();
        data.users.add_test_user(User::Confirmed(ConfirmedUser {
            principal: Principal::from_slice(&[2]),
            phone_number: Some(PhoneNumber::new(44, "1111 111 111".to_owned())),
            date_confirmed: env.now,
            ..Default::default()
        }));
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
