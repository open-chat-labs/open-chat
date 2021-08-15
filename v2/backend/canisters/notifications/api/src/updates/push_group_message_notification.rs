use candid::CandidType;
use serde::Deserialize;
use types::GroupMessageNotification;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub notification: GroupMessageNotification,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success,
}
