use candid::CandidType;
use serde::Deserialize;
use types::{UserId, V1GroupMessageNotification};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub recipients: Vec<UserId>,
    pub notification: V1GroupMessageNotification,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
}
