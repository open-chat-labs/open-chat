use crate::TimestampNanos;
use candid::{CandidType, Deserialize};
use serde::Serialize;
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Delegation {
    #[serde(with = "serde_bytes")]
    pub pubkey: Vec<u8>,
    pub expiration: TimestampNanos,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SignedDelegation {
    pub delegation: Delegation,
    #[serde(with = "serde_bytes")]
    pub signature: Vec<u8>,
}
