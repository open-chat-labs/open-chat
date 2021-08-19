use candid::CandidType;
use serde::Deserialize;
use types::{UserId, V1DirectMessageNotification};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub recipient: UserId,
    pub notification: V1DirectMessageNotification,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
}
