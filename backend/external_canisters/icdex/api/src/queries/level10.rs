use crate::Orderbook;
use candid::Nat;

pub type Args = ();
pub type Response = (Nat, Orderbook);
