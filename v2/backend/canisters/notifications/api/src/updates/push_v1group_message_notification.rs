use candid::CandidType;
use serde::Deserialize;
use types::V1GroupMessageNotification;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub notification: V1GroupMessageNotification,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
}
