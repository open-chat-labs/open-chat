use candid::CandidType;
use crate::canister::RUNTIME_STATE;
use crate::domain::phone_index::{RegisterRequest, RegisterResult};
use crate::runtime_state::RuntimeState;
use ic_cdk_macros::update;
use phonenumber::PhoneNumber;
use serde::Deserialize;
use shared::time::{Milliseconds};
use std::str::FromStr;

#[update]
fn register(request: Request) -> Response {
    RUNTIME_STATE.with(|state| {
        register_impl(request, state.borrow_mut().as_mut().unwrap())
    })
}

fn register_impl(request: Request, runtime_state: &mut RuntimeState) -> Response {
    match PhoneNumber::from_str(&format!("+{} {}", request.phone_number.country_code, request.phone_number.number)) {
        Ok(phone_number) => {
            let register_request = RegisterRequest {
                caller: runtime_state.env.caller(),
                phone_number,
                now: runtime_state.env.now(),
                confirmation_code: format!("{:0>6}", runtime_state.env.random_u32())                
            };

            match runtime_state.phone_index.register(register_request) {
                RegisterResult::Success => Response::Success,
                RegisterResult::AlreadyRegistered => Response::AlreadyRegistered,
                RegisterResult::AlreadyRegisteredByOther => Response::AlreadyRegisteredByOther,
                RegisterResult::AlreadyRegisteredButUnclaimed(r) => Response::AlreadyRegisteredButUnclaimed(
                    AlreadyRegisteredButUnclaimedResult {
                        time_until_resend_code_permitted: r
                    }
                )
            }
        },
        Err(_) => Response::InvalidPhoneNumber
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
    AlreadyRegisteredButUnclaimed(AlreadyRegisteredButUnclaimedResult),
    InvalidPhoneNumber,
}

#[derive(CandidType)]
pub struct AlreadyRegisteredButUnclaimedResult {
    time_until_resend_code_permitted: Option<Milliseconds>
}
