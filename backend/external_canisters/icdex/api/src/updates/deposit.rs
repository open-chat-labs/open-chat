use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

pub type Args = (Token0OrToken1, Nat, Option<[u8; 32]>);
pub type Response = ();

#[derive(CandidType, Serialize, Deserialize)]
pub enum Token0OrToken1 {
    #[serde(rename = "token0")]
    Token0,
    #[serde(rename = "token1")]
    Token1,
}
