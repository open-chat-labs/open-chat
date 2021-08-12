use candid::CandidType;
use serde::Deserialize;
use types::confirmation_code_sms::ConfirmationCodeSms;
use types::indexed_event::IndexedEvent;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub from_index: u64,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success(SuccessResult),
    NotAuthorized,
}

#[derive(CandidType, Deserialize)]
pub struct SuccessResult {
    pub messages: Vec<IndexedEvent<ConfirmationCodeSms>>,
}
