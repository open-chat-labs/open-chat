use candid::CandidType;
use serde::Deserialize;
use types::V1DirectMessageNotification;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub notification: V1DirectMessageNotification,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success,
}
