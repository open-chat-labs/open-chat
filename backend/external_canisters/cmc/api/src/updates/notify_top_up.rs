use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

pub type CanisterId = Principal;
pub type Cycles = u128;
pub type BlockIndex = u64;

#[derive(CandidType)]
pub struct Args {
    pub block_index: BlockIndex,
    pub canister_id: CanisterId,
}

pub type Response = Result<Cycles, NotifyError>;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum NotifyError {
    Refunded {
        reason: String,
        block_index: Option<BlockIndex>,
    },
    InvalidTransaction(String),
    TransactionTooOld(BlockIndex),
    Processing,
    Other {
        error_code: u64,
        error_message: String,
    },
}
