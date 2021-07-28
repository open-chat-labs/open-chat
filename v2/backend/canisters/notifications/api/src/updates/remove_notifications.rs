use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub up_to_notification_index: u64,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success,
    NotAuthorized,
}
