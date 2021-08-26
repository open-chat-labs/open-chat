use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Args {}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
}
