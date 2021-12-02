use candid::CandidType;
use serde::Deserialize;
use types::{GroupMessageNotification, UserId};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub recipients: Vec<UserId>,
    pub notification: GroupMessageNotification,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
}
