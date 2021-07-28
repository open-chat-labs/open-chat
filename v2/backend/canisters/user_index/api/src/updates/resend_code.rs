use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize)]
pub struct Args {}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success,
    AlreadyClaimed,
    UserNotFound,
}
