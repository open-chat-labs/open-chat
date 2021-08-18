use candid::CandidType;
use serde::Deserialize;
use types::DirectMessageNotification;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub notification: DirectMessageNotification,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
}
