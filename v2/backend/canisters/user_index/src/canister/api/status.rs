use candid::{CandidType, Principal};
use crate::canister::RUNTIME_STATE;
use crate::data::{StatusResult, StatusRequest};
use crate::runtime_state::RuntimeState;
use ic_cdk_macros::query;
use phonenumber::{Mode};
use serde::Deserialize;
use shared::time::{Milliseconds};

#[query]
fn status(_request: Request) -> Response {
    RUNTIME_STATE.with(|state| {
        status_impl(state.borrow().as_ref().unwrap())
    })
}

fn status_impl(runtime_state: &RuntimeState) -> Response {
    let status_request = StatusRequest {
        caller: runtime_state.env.caller(),
        now: runtime_state.env.now()
    };

    match runtime_state.data.status(status_request) {
        StatusResult::NotFound => Response::NotFound,
        StatusResult::Unconfirmed(uc) => Response::Unconfirmed(UnconfirmedResult {
            phone_number: PhoneNumber {
                country_code: uc.phone_number.code().value(),
                number: uc.phone_number.format().mode(Mode::National).to_string()
            },
            time_until_resend_code_permitted: uc.time_until_resend_code_permitted
        }),
        StatusResult::ConfirmedPendingUsername => Response::ConfirmedPendingUsername,
        StatusResult::ConfirmedPendingCanisterCreation => Response::ConfirmedPendingCanisterCreation,
        StatusResult::Created(user_id) => Response::Created(CreatedResult { user_id }),
    }
}

#[derive(Deserialize)]
pub struct Request {
}

#[derive(CandidType)]
pub enum Response {
    NotFound,
    Unconfirmed(UnconfirmedResult),
    ConfirmedPendingUsername,
    ConfirmedPendingCanisterCreation,
    Created(CreatedResult),
}

#[derive(CandidType)]
pub struct PhoneNumber {
    country_code: u16,
    number: String,
}

#[derive(CandidType)]
pub struct UnconfirmedResult {
    phone_number: PhoneNumber,
    time_until_resend_code_permitted: Option<Milliseconds>
}

#[derive(CandidType)]
pub struct CreatedResult {
    user_id: Principal,
}

