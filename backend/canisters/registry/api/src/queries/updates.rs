use crate::{MessageFilterSummary, NervousSystemSummary, TokenDetails};
use candid::CandidType;
use ts_export::ts_export;
use types::TimestampMillis;

#[ts_export(registry, updates)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub since: Option<TimestampMillis>,
}

#[ts_export(registry, updates)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(SuccessResult),
    SuccessNoUpdates,
}

#[ts_export(registry, updates)]
#[derive(CandidType, Debug)]
pub struct SuccessResult {
    pub last_updated: TimestampMillis,
    pub token_details: Option<Vec<TokenDetails>>,
    pub nervous_system_details: Vec<NervousSystemSummary>,
    pub message_filters_added: Vec<MessageFilterSummary>,
    pub message_filters_removed: Vec<u64>,
}
