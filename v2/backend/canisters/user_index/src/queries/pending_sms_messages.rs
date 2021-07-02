use crate::model::confirmation_code_sms::ConfirmationCodeSms;
use crate::model::runtime_state::RuntimeState;
use candid::CandidType;
use serde::Deserialize;

pub fn query(request: Request, runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();

    if !runtime_state.env.sms_service_principals().contains(&caller) {
        return Response::Unauthorized;
    }

    let mut messages = Vec::new();
    if let Some(earliest_index) = runtime_state.data.sms_queue.back().map(|s| s.index) {
        let from_index = request.from_index - earliest_index;
        for i in from_index..(from_index + request.max_results) {
            if let Some(message) = runtime_state.data.sms_queue.get(i as usize) {
                messages.push(message.clone());
            } else {
                break;
            }
        }
    }

    Response::Success(SuccessResult { messages })
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
    messages: Vec<ConfirmationCodeSms>,
}
