use candid::CandidType;
use serde::Deserialize;
use types::GroupMessageNotification;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub notification: GroupMessageNotification,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
}
