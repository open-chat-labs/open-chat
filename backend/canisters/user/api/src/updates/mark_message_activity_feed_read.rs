use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::TimestampMillis;

#[ts_export(user, mark_read)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub read_up_to: TimestampMillis,
}

#[ts_export(user, mark_read)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
