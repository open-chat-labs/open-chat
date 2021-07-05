use crate::model::data::{append_sms_to_queue, CONFIRMATION_CODE_EXPIRY_MILLIS};
use crate::model::runtime_state::RuntimeState;
use crate::model::user::{UnconfirmedUser, User};
use crate::model::user_map::AddUserResult;
use candid::CandidType;
use phonenumber::PhoneNumber;
use serde::Deserialize;
use shared::time::Milliseconds;
use std::str::FromStr;

pub fn update(request: Request, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let now = runtime_state.env.now();

    match PhoneNumber::from_str(&format!(
        "+{} {}",
        request.phone_number.country_code, request.phone_number.number
    )) {
        Ok(phone_number) => {
            let mut sms_messages_sent = 0u16;

            if let Some(user) = runtime_state.data.users.get_by_principal(&caller) {
                match user {
                    User::Unconfirmed(u) => {
                        sms_messages_sent = u.sms_messages_sent;
                        runtime_state.data.users.remove_by_principal(&caller);
                    }
                    _ => return Response::AlreadyRegistered,
                }
            } else if let Some(user) = runtime_state.data.users.get_by_phone_number(&phone_number) {
                match user {
                    User::Unconfirmed(u) => {
                        let code_expires_at = u.date_generated + CONFIRMATION_CODE_EXPIRY_MILLIS;
                        let has_code_expired = now > code_expires_at;
                        if !has_code_expired {
                            return Response::AlreadyRegisteredByOther;
                        }
                    }
                    _ => {
                        return if user.get_principal() == caller {
                            Response::AlreadyRegistered
                        } else {
                            // TODO we should support the case where a phone number is recycled
                            Response::AlreadyRegisteredByOther
                        };
                    }
                }
            }

            let confirmation_code = format!("{:0>6}", runtime_state.env.random_u32());

            let user = UnconfirmedUser {
                principal: caller,
                phone_number: phone_number.clone(),
                confirmation_code: confirmation_code.clone(),
                date_generated: now,
                sms_messages_sent: sms_messages_sent + 1,
            };

            if matches!(runtime_state.data.users.add(User::Unconfirmed(user)), AddUserResult::Success) {
                append_sms_to_queue(&mut runtime_state.data.sms_queue, phone_number, confirmation_code);
                Response::Success
            } else {
                panic!("Failed to add user");
            }
        }
        Err(_) => Response::InvalidPhoneNumber,
    }
}

#[derive(Deserialize)]
pub struct Request {
    phone_number: UnvalidatedPhoneNumber,
}

#[derive(Deserialize)]
pub struct UnvalidatedPhoneNumber {
    country_code: u16,
    number: String,
}

#[derive(CandidType)]
pub enum Response {
    Success,
    AlreadyRegistered,
    AlreadyRegisteredByOther,
    InvalidPhoneNumber,
}

#[derive(CandidType)]
pub struct AlreadyRegisteredButUnclaimedResult {
    time_until_resend_code_permitted: Option<Milliseconds>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::data::Data;
    use crate::model::runtime_state::RuntimeState;
    use crate::model::user::{CanisterCreationStatus, ConfirmedUser};
    use crate::test::env::TestEnv;
    use candid::Principal;

    #[test]
    fn new_user_succeeds() {
        let env = TestEnv::default();
        let mut runtime_state = RuntimeState::new(Box::new(env), Data::default());

        let request = Request {
            phone_number: UnvalidatedPhoneNumber {
                country_code: 44,
                number: "1111 111 111".to_string(),
            },
        };
        let result = update(request, &mut runtime_state);
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

        let request1 = Request {
            phone_number: UnvalidatedPhoneNumber {
                country_code: 44,
                number: "1111 111 111".to_string(),
            },
        };
        let result1 = update(request1, &mut runtime_state);
        assert!(matches!(result1, Response::Success));

        let request2 = Request {
            phone_number: UnvalidatedPhoneNumber {
                country_code: 44,
                number: "2222 222 222".to_string(),
            },
        };
        let result2 = update(request2, &mut runtime_state);
        assert!(matches!(result2, Response::Success));

        let user = runtime_state
            .data
            .users
            .get_by_principal(&runtime_state.env.caller())
            .unwrap();
        assert!(matches!(user, User::Unconfirmed(_)));
        assert_eq!(user.get_phone_number().national().value(), 2222222222);
    }

    #[test]
    fn existing_confirmed_user_returns_already_registered() {
        let env = Box::new(TestEnv::default());
        let mut data = Data::default();
        data.users.add(User::Confirmed(ConfirmedUser {
            principal: env.caller,
            phone_number: PhoneNumber::from_str("+44 1111 111 111").unwrap(),
            user_id: None,
            username: None,
            canister_creation_status: CanisterCreationStatus::Pending,
            date_confirmed: env.now,
        }));
        let mut runtime_state = RuntimeState::new(env, data);

        let request = Request {
            phone_number: UnvalidatedPhoneNumber {
                country_code: 44,
                number: "2222 222 222".to_string(),
            },
        };
        let result = update(request, &mut runtime_state);
        assert!(matches!(result, Response::AlreadyRegistered));
    }

    #[test]
    fn phone_number_taken_returns_already_taken_by_other() {
        let env = TestEnv::default();
        let mut data = Data::default();
        data.users.add(User::Confirmed(ConfirmedUser {
            principal: Principal::from_slice(&[2]),
            phone_number: PhoneNumber::from_str("+44 1111 111 111").unwrap(),
            user_id: None,
            username: None,
            canister_creation_status: CanisterCreationStatus::Pending,
            date_confirmed: env.now,
        }));
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let request = Request {
            phone_number: UnvalidatedPhoneNumber {
                country_code: 44,
                number: "1111 111 111".to_string(),
            },
        };
        let result = update(request, &mut runtime_state);
        assert!(matches!(result, Response::AlreadyRegisteredByOther));
    }

    #[test]
    fn invalid_phone_number() {
        let env = TestEnv::default();
        let mut runtime_state = RuntimeState::new(Box::new(env), Data::default());

        let request = Request {
            phone_number: UnvalidatedPhoneNumber {
                country_code: 44,
                number: "_".to_string(),
            },
        };
        let result = update(request, &mut runtime_state);
        assert!(matches!(result, Response::InvalidPhoneNumber));
    }
}

#[cfg(test)]
mod tests {
    use candid::Principal;
    use crate::model::data::Data;
    use crate::model::runtime_state::RuntimeState;
    use crate::model::user::{CanisterCreationStatus, ConfirmedUser};
    use crate::test::env::TestEnv;
    use super::*;

    #[test]
    fn new_user_returns_success() {
        let env = Box::new(TestEnv::default());
        let mut runtime_state = RuntimeState::new(env, Data::default());

        let request = Request {
            phone_number: UnvalidatedPhoneNumber {
                country_code: 44,
                number: "1111 111 111".to_string()
            }
        };
        let result = update(request, &mut runtime_state);
        assert!(matches!(result, Response::Success));
    }

    #[test]
    fn existing_unconfirmed_user_returns_success() {
        let env = Box::new(TestEnv::default());
        let mut runtime_state = RuntimeState::new(env, Data::default());

        let request1 = Request {
            phone_number: UnvalidatedPhoneNumber {
                country_code: 44,
                number: "1111 111 111".to_string()
            }
        };
        let result1 = update(request1, &mut runtime_state);
        assert!(matches!(result1, Response::Success));

        let request2 = Request {
            phone_number: UnvalidatedPhoneNumber {
                country_code: 44,
                number: "2222 222 222".to_string()
            }
        };
        let result2 = update(request2, &mut runtime_state);
        assert!(matches!(result2, Response::Success));
    }

    #[test]
    fn existing_confirmed_user_returns_already_registered() {
        let env = Box::new(TestEnv::default());
        let mut data = Data::default();
        data.users.add(User::Confirmed(ConfirmedUser {
            principal: env.caller,
            phone_number: PhoneNumber::from_str("+44 1111 111 111").unwrap(),
            user_id: None,
            username: None,
            canister_creation_status: CanisterCreationStatus::Pending,
            date_confirmed: env.now,
        }));
        let mut runtime_state = RuntimeState::new(env, data);

        let request = Request {
            phone_number: UnvalidatedPhoneNumber {
                country_code: 44,
                number: "2222 222 222".to_string()
            }
        };
        let result = update(request, &mut runtime_state);
        assert!(matches!(result, Response::AlreadyRegistered));
    }

    #[test]
    fn phone_number_taken_returns_already_taken_by_other() {
        let env = TestEnv::default();
        let mut data = Data::default();
        data.users.add(User::Confirmed(ConfirmedUser {
            principal: Principal::from_slice(&[2]),
            phone_number: PhoneNumber::from_str("+44 1111 111 111").unwrap(),
            user_id: None,
            username: None,
            canister_creation_status: CanisterCreationStatus::Pending,
            date_confirmed: env.now,
        }));
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let request = Request {
            phone_number: UnvalidatedPhoneNumber {
                country_code: 44,
                number: "1111 111 111".to_string()
            }
        };
        let result = update(request, &mut runtime_state);
        assert!(matches!(result, Response::AlreadyRegisteredByOther));
    }

    #[test]
    fn invalid_phone_number() {
        let env = TestEnv::default();
        let mut runtime_state = RuntimeState::new(Box::new(env), Data::default());

        let request = Request {
            phone_number: UnvalidatedPhoneNumber {
                country_code: 44,
                number: "_".to_string()
            }
        };
        let result = update(request, &mut runtime_state);
        assert!(matches!(result, Response::InvalidPhoneNumber));
    }
}
