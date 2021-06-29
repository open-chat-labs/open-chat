use candid::{CandidType, Principal};
use crate::canister::RUNTIME_STATE;
use crate::runtime_state::RuntimeState;
use ic_cdk_macros::query;
use serde::Deserialize;

#[query]
fn status(request: ApiRequest) -> ApiResponse {
    RUNTIME_STATE.with(|state| {
        status_impl(request, state.borrow_mut().as_mut().unwrap())
    })
}

fn status_impl(request: ApiRequest, runtime_state: &mut RuntimeState) -> ApiResponse {
    ApiResponse::NotFound
}

#[derive(Deserialize)]
pub struct ApiRequest {
}

#[derive(CandidType)]
pub enum ApiResponse {
    NotFound,
    Registered(RegisteredResult),
    Claimed(ClaimedResult),
}

#[derive(CandidType)]
pub struct PhoneNumber {
    country_code: u16,
    number: String,
}

#[derive(CandidType)]
pub struct RegisteredResult {
    phone_number: PhoneNumber,
}

#[derive(CandidType)]
pub struct ClaimedResult {
    canister_id: Principal,
}

