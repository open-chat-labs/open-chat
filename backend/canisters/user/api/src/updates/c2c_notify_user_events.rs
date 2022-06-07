use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::UserEvent;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<UserEvent>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
