use candid::CandidType;
use serde::Deserialize;
use types::{DirectMessageNotification, UserId};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub recipient: UserId,
    pub notification: DirectMessageNotification,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
}
