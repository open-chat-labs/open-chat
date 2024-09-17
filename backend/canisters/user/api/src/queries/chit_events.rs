use candid::CandidType;
use ts_export::ts_export;
use types::{ChitEarned, TimestampMillis};

#[ts_export(user, chit_events)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub from: Option<TimestampMillis>,
    pub to: Option<TimestampMillis>,
    pub skip: Option<u32>,
    pub max: u32,
    pub ascending: bool,
}

#[ts_export(user, chit_events)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[ts_export(user, chit_events)]
#[derive(CandidType, Debug)]
pub struct SuccessResult {
    pub events: Vec<ChitEarned>,
    pub total: u32,
}
