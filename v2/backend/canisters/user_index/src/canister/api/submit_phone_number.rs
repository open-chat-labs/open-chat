use candid::CandidType;
use crate::canister::RUNTIME_STATE;
use crate::data::{SubmitPhoneNumberRequest, SubmitPhoneNumberResult};
use crate::runtime_state::RuntimeState;
use ic_cdk_macros::update;
use phonenumber::PhoneNumber;
use serde::Deserialize;
use shared::time::{Milliseconds};
use std::str::FromStr;

#[update]
fn submit_phone_number(request: Request) -> Response {
    RUNTIME_STATE.with(|state| {
        submit_phone_number_impl(request, state.borrow_mut().as_mut().unwrap())
    })
}

fn submit_phone_number_impl(request: Request, runtime_state: &mut RuntimeState) -> Response {
    match PhoneNumber::from_str(&format!("+{} {}", request.phone_number.country_code, request.phone_number.number)) {
        Ok(phone_number) => {
            let submit_phone_number_request = SubmitPhoneNumberRequest {
                caller: runtime_state.env.caller(),
                phone_number,
                now: runtime_state.env.now(),
                confirmation_code: format!("{:0>6}", runtime_state.env.random_u32())                
            };

            match runtime_state.data.submit_phone_number(submit_phone_number_request) {
                SubmitPhoneNumberResult::Success => Response::Success,
                SubmitPhoneNumberResult::AlreadyRegistered => Response::AlreadyRegistered,
                SubmitPhoneNumberResult::AlreadyRegisteredByOther => Response::AlreadyRegisteredByOther,
                SubmitPhoneNumberResult::AlreadyRegisteredButUnclaimed(r) => Response::AlreadyRegisteredButUnclaimed(
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
