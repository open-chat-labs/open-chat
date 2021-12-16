use candid::CandidType;
use serde::Deserialize;
use types::{ConfirmationCodeSms, IndexedEvent};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub from_index: u64,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub messages: Vec<IndexedEvent<ConfirmationCodeSms>>,
}
