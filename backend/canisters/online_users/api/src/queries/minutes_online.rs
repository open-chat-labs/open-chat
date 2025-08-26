use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export(online_users, minutes_online)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub year: u32,
    pub month: u8,
}

#[ts_export(online_users, minutes_online)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(u16),
}
