use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatId, Milliseconds};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub groups: Vec<ChatId>,
    pub duration: Option<Milliseconds>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
