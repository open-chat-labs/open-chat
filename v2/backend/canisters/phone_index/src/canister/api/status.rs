use candid::{CandidType, Principal};
use crate::canister::RUNTIME_STATE;
use crate::domain::phone_index::{StatusRequest, StatusResult};
use crate::runtime_state::RuntimeState;
use ic_cdk_macros::query;
use phonenumber::{Mode};
use serde::Deserialize;
use shared::time::{Milliseconds};

#[query]
fn status(_request: ApiRequest) -> ApiResponse {
    RUNTIME_STATE.with(|state| {
        status_impl(state.borrow().as_ref().unwrap())
    })
}

fn status_impl(runtime_state: &RuntimeState) -> ApiResponse {
    let status_request = StatusRequest {
        caller: runtime_state.env.caller(),
        now: runtime_state.env.now()
    };

    match runtime_state.phone_index.status(status_request) {
        StatusResult::NotFound => ApiResponse::NotFound,
        StatusResult::Unclaimed(uc) => ApiResponse::Unclaimed(UnclaimedResult {
            phone_number: PhoneNumber {
                country_code: uc.phone_number.code().value(),
                number: uc.phone_number.format().mode(Mode::National).to_string()
            },
            time_until_resend_code_permitted: uc.time_until_resend_code_permitted
        }),
        StatusResult::Claimed(canister_id) => ApiResponse::Claimed(ClaimedResult {
            canister_id
        })
    }
}

#[derive(Deserialize)]
pub struct ApiRequest {
}

#[derive(CandidType)]
pub enum ApiResponse {
    NotFound,
    Unclaimed(UnclaimedResult),
    Claimed(ClaimedResult),
}

#[derive(CandidType)]
pub struct PhoneNumber {
    country_code: u16,
    number: String,
}

#[derive(CandidType)]
pub struct UnclaimedResult {
    phone_number: PhoneNumber,
    time_until_resend_code_permitted: Option<Milliseconds>
}

#[derive(CandidType)]
pub struct ClaimedResult {
    canister_id: Principal,
}

