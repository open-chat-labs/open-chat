use candid::CandidType;
use crate::canister::RUNTIME_STATE;
use crate::data::{ConfirmPhoneNumberRequest, ConfirmPhoneNumberResult};
use ic_cdk_macros::update;
use serde::Deserialize;

#[update]
pub fn confirm_phone_number(request: Request) -> Response {
    let (caller, now) = RUNTIME_STATE.with(|state| {
        state.borrow().as_ref().map(|s| (s.env.caller(), s.env.now())).unwrap()
    });

    let confirm_phone_number_request = ConfirmPhoneNumberRequest {
        caller, 
        confirmation_code: request.confirmation_code, 
        now
    };

    let confirm_phone_number_result = RUNTIME_STATE.with(|state| {
        state.borrow_mut().as_mut().unwrap().data.confirm_phone_number(confirm_phone_number_request)
    });

    match confirm_phone_number_result {
        ConfirmPhoneNumberResult::Success(_) => Response::Success,
        ConfirmPhoneNumberResult::ConfirmationCodeIncorrect => Response::ConfirmationCodeIncorrect,
        ConfirmPhoneNumberResult::ConfirmationCodeExpired => Response::ConfirmationCodeExpired,
        ConfirmPhoneNumberResult::AlreadyClaimed => Response::AlreadyClaimed,
        ConfirmPhoneNumberResult::NotFound => Response::NotFound,
    }
}

#[derive(Deserialize)]
pub struct Request {
    confirmation_code: String
}

#[derive(CandidType)]
pub enum Response {
    Success,
    ConfirmationCodeIncorrect,
    ConfirmationCodeExpired,
    AlreadyClaimed,
    NotFound,
}
