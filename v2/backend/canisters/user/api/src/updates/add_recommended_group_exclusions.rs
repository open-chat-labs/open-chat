use candid::CandidType;
use serde::Deserialize;
use types::{ChatId, Milliseconds};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub groups: Vec<ChatId>,
    pub duration: Option<Milliseconds>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
}
