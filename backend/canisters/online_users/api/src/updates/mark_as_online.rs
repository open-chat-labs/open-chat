use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{Empty, TimestampMillis};

pub type Args = Empty;

#[ts_export(online_users, mark_as_online)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    SuccessV2(SuccessResult),
    UserNotFound,
    InternalError(String),
}

#[ts_export(online_users, mark_as_online)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub year: u32,
    pub month: u8,
    pub minutes_online: u16,
}
