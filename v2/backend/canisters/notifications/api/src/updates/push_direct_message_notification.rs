use candid::CandidType;
use serde::Deserialize;
use shared::types::notifications::DirectMessageNotification;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub notification: DirectMessageNotification,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success,
}
