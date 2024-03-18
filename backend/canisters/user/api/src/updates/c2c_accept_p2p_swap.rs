use candid::CandidType;
use icrc_ledger_types::icrc1::transfer::TransferError;
use serde::{Deserialize, Serialize};
use types::{Milliseconds, P2PSwapLocation, TimestampMillis, TokenInfo, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub swap_id: u32,
    pub location: P2PSwapLocation,
    pub created: TimestampMillis,
    pub created_by: UserId,
    pub token0: TokenInfo,
    pub token0_amount: u128,
    pub token0_txn_in: u64,
    pub token1: TokenInfo,
    pub token1_amount: u128,
    pub expires_at: TimestampMillis,
    pub pin_attempt: Option<Vec<u8>>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(u64),
    TransferError(TransferError),
    PinRequired,
    PinIncorrect(Option<Milliseconds>),
    TooManyFailedPinAttempts(Milliseconds),
    InternalError(String),
}
