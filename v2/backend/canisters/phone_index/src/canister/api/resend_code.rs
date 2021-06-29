use candid::CandidType;
use crate::canister::RUNTIME_STATE;
use crate::domain::phone_index::{ResendCodeRequest, ResendCodeResult};
use crate::runtime_state::RuntimeState;
use ic_cdk_macros::update;
use serde::Deserialize;
use shared::time::Milliseconds;

#[update]
pub async fn resend_code(_: ApiRequest) -> ApiResponse {
    RUNTIME_STATE.with(|state| {
        resend_code_impl(state.borrow_mut().as_mut().unwrap())
    })
}

fn resend_code_impl(runtime_state: &mut RuntimeState) -> ApiResponse {
    let caller = runtime_state.env.caller();
    let now = runtime_state.env.now();
    let resend_code_request = ResendCodeRequest::new(caller, now);

    match runtime_state.phone_index.resend_code(resend_code_request) {
        ResendCodeResult::Success => ApiResponse::Success,
        ResendCodeResult::AlreadyClaimed => ApiResponse::AlreadyClaimed,
        ResendCodeResult::CodeNotExpiredYet(milliseconds) => ApiResponse::CodeNotExpiredYet(
            CodeNotExpiredYetResult {
                time_until_resend_code_permitted: milliseconds
            }
        ),
        ResendCodeResult::NotFound => ApiResponse::NotFound
    }
}

#[derive(Deserialize)]
pub struct ApiRequest {
}

#[derive(CandidType)]
pub enum ApiResponse {
    Success,
    AlreadyClaimed,
    CodeNotExpiredYet(CodeNotExpiredYetResult),
    NotFound,
}

#[derive(CandidType)]
pub struct CodeNotExpiredYetResult {
    time_until_resend_code_permitted: Milliseconds
}