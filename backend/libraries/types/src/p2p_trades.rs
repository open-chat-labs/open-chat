use crate::icrc1::CompletedCryptoTransaction;
use crate::{P2PTradeStatus, TimestampMillis, TransactionId, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub enum OfferStatus {
    Open,
    Cancelled(Box<OfferStatusCancelled>),
    Expired,
    Accepted(Box<OfferStatusAccepted>),
    Completed(Box<OfferStatusCompleted>),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct OfferStatusCancelled {
    pub cancelled_at: TimestampMillis,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct OfferStatusAccepted {
    pub accepted_by: UserId,
    pub accepted_at: TimestampMillis,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct OfferStatusCompleted {
    pub accepted_by: UserId,
    pub accepted_at: TimestampMillis,
    pub token0_transfer_out: CompletedCryptoTransaction,
    pub token1_transfer_out: CompletedCryptoTransaction,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct OfferStatusChange {
    pub offer_id: u32,
    pub status: OfferStatus,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct AcceptSwapSuccess {
    pub token1_txn_in: TransactionId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum AcceptSwapStatusError {
    AlreadyReserved(AcceptSwapAlreadyReserved),
    AlreadyAccepted(AcceptSwapAlreadyAccepted),
    AlreadyCompleted(AcceptSwapAlreadyCompleted),
    OfferExpired(AcceptSwapOfferExpired),
    OfferCancelled(AcceptSwapOfferCancelled),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct AcceptSwapAlreadyReserved {
    pub reserved_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct AcceptSwapAlreadyAccepted {
    pub accepted_by: UserId,
    pub token1_txn_in: TransactionId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct AcceptSwapAlreadyCompleted {
    pub accepted_by: UserId,
    pub token1_txn_in: TransactionId,
    pub token0_txn_out: TransactionId,
    pub token1_txn_out: TransactionId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct AcceptSwapOfferExpired {
    pub token0_txn_out: Option<TransactionId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct AcceptSwapOfferCancelled {
    pub token0_txn_out: Option<TransactionId>,
}

impl From<P2PTradeStatus> for AcceptSwapStatusError {
    fn from(value: P2PTradeStatus) -> Self {
        match value {
            P2PTradeStatus::Open => unreachable!(),
            P2PTradeStatus::Cancelled(s) => AcceptSwapStatusError::OfferCancelled(AcceptSwapOfferCancelled {
                token0_txn_out: s.token0_txn_out,
            }),
            P2PTradeStatus::Expired(s) => AcceptSwapStatusError::OfferExpired(AcceptSwapOfferExpired {
                token0_txn_out: s.token0_txn_out,
            }),
            P2PTradeStatus::Reserved(s) => AcceptSwapStatusError::AlreadyReserved(AcceptSwapAlreadyReserved {
                reserved_by: s.reserved_by,
            }),
            P2PTradeStatus::Accepted(s) => AcceptSwapStatusError::AlreadyAccepted(AcceptSwapAlreadyAccepted {
                accepted_by: s.accepted_by,
                token1_txn_in: s.token1_txn_in,
            }),
            P2PTradeStatus::Completed(s) => AcceptSwapStatusError::AlreadyCompleted(AcceptSwapAlreadyCompleted {
                accepted_by: s.accepted_by,
                token1_txn_in: s.token1_txn_in,
                token0_txn_out: s.token0_txn_out,
                token1_txn_out: s.token1_txn_out,
            }),
        }
    }
}
