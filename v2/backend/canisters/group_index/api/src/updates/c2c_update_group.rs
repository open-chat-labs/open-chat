use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub name: String,
    pub description: String,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    NameTaken,
    ChatNotFound,
}
