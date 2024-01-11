use crate::icrc1::CompletedCryptoTransaction;
use crate::{TimestampMillis, UserId};
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
