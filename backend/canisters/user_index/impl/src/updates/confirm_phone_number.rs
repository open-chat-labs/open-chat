use crate::model::user_map::ConfirmPhoneNumberResult;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use local_user_index_canister::{Event, PhoneNumberConfirmed};
use open_storage_index_canister::add_or_update_users::UserConfig;
use user_index_canister::confirm_phone_number::{Response::*, *};

#[update]
#[trace]
fn confirm_phone_number(args: Args) -> Response {
    mutate_state(|state| confirm_phone_number_impl(args, state))
}

fn confirm_phone_number_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let now = runtime_state.env.now();

    match runtime_state
        .data
        .users
        .confirm_phone_number(caller, args.confirmation_code, runtime_state.data.test_mode, now)
    {
        ConfirmPhoneNumberResult::Success(result) => {
            runtime_state.data.push_event_to_local_user_index(
                result.user_id,
                Event::PhoneNumberConfirmed(PhoneNumberConfirmed {
                    user_id: result.user_id,
                    phone_number: result.phone_number,
                    storage_added: result.storage_added,
                    new_storage_limit: result.new_byte_limit,
                }),
            );
            // NOTE: If we later allow a user to change their already confirmed phone number
            // we must remember not to increase their byte_limit in this case
            runtime_state.data.open_storage_user_sync_queue.push(UserConfig {
                user_id: caller,
                byte_limit: result.new_byte_limit,
            });
            Success(SuccessResult {
                open_storage_limit_bytes: result.new_byte_limit,
            })
        }
        ConfirmPhoneNumberResult::CodeExpired => ConfirmationCodeExpired,
        ConfirmPhoneNumberResult::CodeIncorrect => ConfirmationCodeIncorrect,
        ConfirmPhoneNumberResult::AlreadyConfirmed => AlreadyClaimed,
        ConfirmPhoneNumberResult::UserNotFound => UserNotFound,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::user::{PhoneStatus, UnconfirmedPhoneNumber, User};
    use crate::Data;
    use types::PhoneNumber;
    use utils::env::test::TestEnv;

    #[test]
    fn correct_code_succeeds() {
        let env = TestEnv::default();
        let confirmation_code = "123456".to_string();
        let mut data = Data::default();
        data.users.add_test_user(User {
            principal: env.caller,
            phone_status: PhoneStatus::Unconfirmed(UnconfirmedPhoneNumber {
                phone_number: PhoneNumber::new(44, "1111 111 111".to_owned()),
                confirmation_code: confirmation_code.clone(),
                valid_until: env.now + 1000,
                sms_messages_sent: 1,
            }),
            ..Default::default()
        });
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let args = Args { confirmation_code };
        let result = confirm_phone_number_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::Success(_)));

        let user = runtime_state
            .data
            .users
            .get_by_principal(&runtime_state.env.caller())
            .unwrap();
        assert!(matches!(user.phone_status, PhoneStatus::Confirmed(_)));
    }

    #[test]
    fn incorrect_code_returns_confirmation_code_incorrect() {
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
        data.users.add_test_user(User {
            principal: env.caller,
            phone_status: PhoneStatus::Unconfirmed(UnconfirmedPhoneNumber {
                phone_number: PhoneNumber::new(44, "1111 111 111".to_owned()),
                confirmation_code: confirmation_code.clone(),
                valid_until: env.now + 1000,
                sms_messages_sent: 1,
            }),
            ..Default::default()
        });
        env.now += 1001;
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let args = Args { confirmation_code };
        let result = confirm_phone_number_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::ConfirmationCodeExpired));
    }

    #[test]
    fn confirmed_phone_number_returns_already_claimed() {
        let env = TestEnv::default();
        let mut data = Data::default();
        data.users.add_test_user(User {
            principal: env.caller,
            phone_status: PhoneStatus::Confirmed(PhoneNumber::new(44, "1111 111 111".to_string())),
            ..Default::default()
        });
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            confirmation_code: "123456".to_string(),
        };
        let result = confirm_phone_number_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::AlreadyClaimed));
    }

    #[test]
    // This is because we prune unconfirmed phone numbers once their codes expire.
    fn no_phone_number_returns_confirmation_code_expired() {
        let env = TestEnv::default();
        let mut data = Data::default();
        data.users.add_test_user(User {
            principal: env.caller,
            ..Default::default()
        });
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            confirmation_code: "123456".to_string(),
        };
        let result = confirm_phone_number_impl(args, &mut runtime_state);
        assert!(matches!(result, Response::ConfirmationCodeExpired));
    }
}
