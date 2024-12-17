use crate::notify_top_up::BlockIndex;
use candid::{CandidType, Deserialize};
use serde::Serialize;

mod queries;
mod updates;

pub use queries::*;
pub use updates::*;

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
