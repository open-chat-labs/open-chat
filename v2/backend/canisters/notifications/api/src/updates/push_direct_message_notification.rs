use candid::CandidType;
use serde::Deserialize;
use types::DirectMessageNotification;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub notification: DirectMessageNotification,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success,
}
