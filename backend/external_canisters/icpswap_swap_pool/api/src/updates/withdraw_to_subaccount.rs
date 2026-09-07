use crate::ICPSwapResult;
use candid::{CandidType, Nat};
use serde::Deserialize;

// Like `withdraw`, but the pool transfers to the given subaccount of the caller rather than to
// the caller's default account.
#[derive(CandidType, Deserialize)]
pub struct Args {
    pub token: String,
    pub amount: Nat,
    pub fee: Nat,
    pub subaccount: Vec<u8>,
}

pub type Response = ICPSwapResult<Nat>;
