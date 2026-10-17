use crate::Side;
use candid::CandidType;
use serde::{Deserialize, Serialize};

// (whose orders, which side): `None` for the side cancels both buys and sells
pub type Args = (Target, Option<Side>);
pub type Response = ();

#[derive(CandidType, Serialize, Deserialize)]
pub enum Target {
    // Only the pair's owner may cancel other accounts' orders
    #[serde(rename = "management")]
    Management(Option<Vec<u8>>),
    // The caller's own orders, under the given subaccount
    #[serde(rename = "self_sa")]
    SelfSa(Option<[u8; 32]>),
}
