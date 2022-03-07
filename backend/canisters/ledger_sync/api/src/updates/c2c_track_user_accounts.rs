use candid::CandidType;
use serde::Deserialize;
use types::UserId;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub users: Vec<UserId>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
}
