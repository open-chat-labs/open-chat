use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::Empty;

pub type Args = Empty;

#[derive(CandidType, Deserialize, Serialize, Debug)]
pub enum Response {
    Success,
}
