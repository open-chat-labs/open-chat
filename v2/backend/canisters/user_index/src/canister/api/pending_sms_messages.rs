use candid::CandidType;
use crate::canister::RUNTIME_STATE;
use crate::model::confirmation_code_sms::ConfirmationCodeSms;
use crate::runtime_state::RuntimeState;
use ic_cdk_macros::query;
use serde::Deserialize;

#[query]
pub fn pending_sms_messages(request: Request) -> Response {
    RUNTIME_STATE.with(|state| {
        pending_sms_messages_impl(request, state.borrow().as_ref().unwrap())
    })
}

fn pending_sms_messages_impl(request: Request, runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();

    if !runtime_state.env.sms_service_principals().contains(&caller) {
        return Response::Unauthorized;
    }

    let pending_sms_messages_request = crate::data::pending_sms_messages::Request {
        from_index: request.from_index,
        max_results: request.max_results
    };

    let result = runtime_state.data.pending_sms_messages(pending_sms_messages_request);

    Response::Success(SuccessResult { messages: result.sms_messages })
}

#[derive(Deserialize)]
pub struct Request {
    from_index: u64,
    max_results: u64,
}

#[derive(CandidType)]
pub enum Response {
    Success(SuccessResult),
    Unauthorized,
}

#[derive(CandidType)]
pub struct SuccessResult {
    messages: Vec<ConfirmationCodeSms>
}
