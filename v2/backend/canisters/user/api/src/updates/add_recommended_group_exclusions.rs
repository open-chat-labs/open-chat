use candid::CandidType;
use serde::Deserialize;
use types::ChatId;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub groups: Vec<ChatId>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
}
