use candid::CandidType;
use serde::Deserialize;
use types::Challenge;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(Challenge),
    Throttled,
}
