use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ConfirmationCodeSms, IndexedEvent};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub from_index: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub messages: Vec<IndexedEvent<ConfirmationCodeSms>>,
}
