use crate::{MessageFilterSummary, NervousSystemSummary, TokenDetails};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::TimestampMillis;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub since: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    SuccessNoUpdates,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub last_updated: TimestampMillis,
    pub token_details: Option<Vec<TokenDetails>>,
    pub nervous_system_details: Vec<NervousSystemSummary>,
    pub message_filters_added: Vec<MessageFilterSummary>,
    pub message_filters_removed: Vec<u64>,
}
