use candid::CandidType;
use serde::Deserialize;
use types::UserId;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub id: String,
    pub offer_id: String,
    pub from: UserId,
    pub connection_string: String,
    pub ice_candidates: Vec<String>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
}
