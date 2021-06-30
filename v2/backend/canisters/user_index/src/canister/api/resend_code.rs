use candid::CandidType;
use crate::canister::RUNTIME_STATE;
use crate::data::resend_code::Result;
use crate::runtime_state::RuntimeState;
use ic_cdk_macros::update;
use serde::Deserialize;
use shared::time::Milliseconds;

#[update]
pub async fn resend_code(_: Request) -> Response {
    RUNTIME_STATE.with(|state| {
        resend_code_impl(state.borrow_mut().as_mut().unwrap())
    })
}

fn resend_code_impl(runtime_state: &mut RuntimeState) -> Response {
    let resend_code_request = crate::data::resend_code::Request {
        caller: runtime_state.env.caller(),
        now: runtime_state.env.now()
    };

    match runtime_state.data.resend_code(resend_code_request) {
        Result::Success => Response::Success,
        Result::AlreadyClaimed => Response::AlreadyClaimed,
        Result::CodeNotExpiredYet(milliseconds) => Response::CodeNotExpiredYet(
            CodeNotExpiredYetResult {
                time_until_resend_code_permitted: milliseconds
            }
        ),
        Result::NotFound => Response::NotFound
    }
}

#[derive(Deserialize)]
pub struct Request {
}

#[derive(CandidType)]
pub enum Response {
    Success,
    AlreadyClaimed,
    CodeNotExpiredYet(CodeNotExpiredYetResult),
    NotFound,
}

#[derive(CandidType)]
pub struct CodeNotExpiredYetResult {
    time_until_resend_code_permitted: Milliseconds
}