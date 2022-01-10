use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub avatar_id: Option<u128>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    UserNotFound,
}
