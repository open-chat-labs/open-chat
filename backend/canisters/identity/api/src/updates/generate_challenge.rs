use crate::Challenge;
use candid::{CandidType, Deserialize};
use serde::Serialize;
use ts_export::ts_export;
use types::Empty;

pub type Args = Empty;

#[ts_export(identity, generate_challenge)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Challenge),
    AlreadyRegistered,
    Throttled,
}
