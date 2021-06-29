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
fn register(request: ApiRequest) -> ApiResponse {
    RUNTIME_STATE.with(|state| {
        register_impl(request, state.borrow_mut().as_mut().unwrap())
    })
}

fn register_impl(request: ApiRequest, runtime_state: &mut RuntimeState) -> ApiResponse {
    match PhoneNumber::from_str(&format!("+{} {}", request.phone_number.country_code, request.phone_number.number)) {
        Ok(phone_number) => {
            let caller = runtime_state.env.caller();
            let now = runtime_state.env.now();
            let confirmation_code = format!("{:0>6}", runtime_state.env.random_u32());
            let register_request = RegisterRequest::new(caller, phone_number, now, confirmation_code);

            match runtime_state.phone_index.register(register_request) {
                RegisterResult::Success => ApiResponse::Success,
                RegisterResult::AlreadyRegistered => ApiResponse::AlreadyRegistered,
                RegisterResult::AlreadyRegisteredByOther => ApiResponse::AlreadyRegisteredByOther,
                RegisterResult::AlreadyRegisteredButUnclaimed(r) => ApiResponse::AlreadyRegisteredButUnclaimed(
                    AlreadyRegisteredButUnclaimedResult {
                        time_until_resend_code_permitted: r
                    }
                )
            }
        },
        Err(_) => ApiResponse::InvalidPhoneNumber
    }
}

#[derive(Deserialize)]
pub struct ApiRequest {
    phone_number: UnvalidatedPhoneNumber,
}

#[derive(Deserialize)]
pub struct UnvalidatedPhoneNumber {
    country_code: u16,
    number: String,
}

#[derive(CandidType)]
pub enum ApiResponse {
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
