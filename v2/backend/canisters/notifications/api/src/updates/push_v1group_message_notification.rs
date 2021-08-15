use candid::CandidType;
use serde::Deserialize;
use types::V1GroupMessageNotification;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub notification: V1GroupMessageNotification,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success,
}
