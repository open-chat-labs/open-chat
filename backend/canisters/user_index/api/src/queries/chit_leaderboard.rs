use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChitUserBalance, Empty};

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Vec<ChitUserBalance>),
}
