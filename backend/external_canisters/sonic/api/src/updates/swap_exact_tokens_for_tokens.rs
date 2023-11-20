use crate::SonicResult;
use candid::{Int, Nat, Principal};

// https://docs.sonic.ooo/dev/swaps-api/update-calls#swap-exact-tokens-for-tokens-swapexacttokensfortokens
pub type Args = (Nat, Nat, Vec<String>, Principal, Int);
pub type Response = (SonicResult<Nat, String>,);
