use crate::Challenge;
use candid::{CandidType, Deserialize};
use serde::Serialize;
use types::Empty;

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Challenge),
    AlreadyRegistered,
    Throttled,
}
