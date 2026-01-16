use candid::{CandidType, Deserialize};
use serde::Serialize;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub link: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    LinkExpired,
    LinkInvalid(String),
    CodeIncorrect,
}
