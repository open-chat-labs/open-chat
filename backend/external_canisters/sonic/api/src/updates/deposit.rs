use crate::SonicResult;
use candid::{Nat, Principal};

pub type Args = (Principal, Nat);
pub type Response = (SonicResult<Nat, String>,);
