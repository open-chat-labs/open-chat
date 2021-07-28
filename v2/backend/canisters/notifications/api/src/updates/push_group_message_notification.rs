use candid::CandidType;
use serde::Deserialize;
use shared::types::notifications::GroupMessageNotification;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub notification: GroupMessageNotification,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success,
}
