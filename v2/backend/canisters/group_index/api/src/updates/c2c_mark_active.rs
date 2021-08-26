use candid::CandidType;
use serde::Deserialize;
use types::Milliseconds;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub duration: Milliseconds,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    ChatNotFound,
}
