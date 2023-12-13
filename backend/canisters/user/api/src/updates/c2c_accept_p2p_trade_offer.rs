use candid::CandidType;
use icrc_ledger_types::icrc1::transfer::TransferError;
use serde::{Deserialize, Serialize};
use types::{TimestampMillis, TokenInfo, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub offer_id: u32,
    pub created: TimestampMillis,
    pub created_by: UserId,
    pub input_token: TokenInfo,
    pub input_amount: u128,
    pub input_transaction_index: u64,
    pub output_token: TokenInfo,
    pub output_amount: u128,
    pub expires_at: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(u64), // The transaction index
    TransferError(TransferError),
    UserNotInGroupOrCommunity,
    InternalError(String),
}
