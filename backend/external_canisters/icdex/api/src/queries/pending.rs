use crate::TrieList;
use candid::Nat;

pub type Args = (String, Option<Nat>, Option<Nat>);
pub type Response = (TrieList,);
