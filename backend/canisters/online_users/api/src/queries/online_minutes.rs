use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export(online_users, online_minutes)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub year: u32,
    pub month: u8,
}

#[ts_export(online_users, online_minutes)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(u16),
}
