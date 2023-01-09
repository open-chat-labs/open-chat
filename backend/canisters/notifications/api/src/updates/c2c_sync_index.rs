use candid::CandidType;
use notifications_index_canister::NotificationsIndexEvent;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<NotificationsIndexEvent>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
