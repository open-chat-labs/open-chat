use candid::CandidType;
use icrc_ledger_types::icrc1::transfer::TransferError;
use serde::{Deserialize, Serialize};
use types::{Chat, TimestampMillis, TokenInfo, TransactionId, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub offer_id: u32,
    pub chat: Chat,
    pub created: TimestampMillis,
    pub created_by: UserId,
    pub token0: TokenInfo,
    pub token0_amount: u128,
    pub token0_txn_in: TransactionId,
    pub token1: TokenInfo,
    pub token1_amount: u128,
    pub expires_at: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(TransactionId),
    TransferError(TransferError),
    InternalError(String),
}
