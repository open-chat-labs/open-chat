use candid::CandidType;
use serde::Deserialize;
use types::V1DirectMessageNotification;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub notification: V1DirectMessageNotification,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
}
