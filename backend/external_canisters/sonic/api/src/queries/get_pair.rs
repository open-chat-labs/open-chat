use crate::PairInfoExt;
use candid::Principal;

pub type Args = (Principal, Principal);
pub type Response = (Option<PairInfoExt>,);
