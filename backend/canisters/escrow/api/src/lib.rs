use candid::{CandidType, Deserialize, Principal};
use icrc_ledger_types::icrc1::account::Subaccount;
use serde::Serialize;
use sha256::sha256;
use types::icrc1::CompletedCryptoTransaction;
use types::{IdempotentEnvelope, P2PSwapLocation, SuccessOnly, TimestampMillis};

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum SwapStatus {
    Open,
    Cancelled(Box<SwapStatusCancelled>),
    Expired(Box<SwapStatusExpired>),
    Accepted(Box<SwapStatusAccepted>),
    Completed(Box<SwapStatusCompleted>),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SwapStatusCancelled {
    pub cancelled_at: TimestampMillis,
    pub refunds: Vec<CompletedCryptoTransaction>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SwapStatusExpired {
    pub refunds: Vec<CompletedCryptoTransaction>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SwapStatusAccepted {
    pub accepted_by: Principal,
    pub accepted_at: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SwapStatusCompleted {
    pub accepted_by: Principal,
    pub accepted_at: TimestampMillis,
    pub token0_transfer_out: CompletedCryptoTransaction,
    pub token1_transfer_out: CompletedCryptoTransaction,
    pub refunds: Vec<CompletedCryptoTransaction>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SwapStatusChange {
    pub swap_id: u32,
    pub offered_by: Principal,
    pub location: P2PSwapLocation,
    pub status: SwapStatus,
}

// What Escrow tells the canister a swap names in `canister_to_notify`, at that canister's `c2c_escrow`
// endpoint. Escrow can't tell what kind of canister that is, so the endpoint's types are defined here
// rather than by each receiver. New variants go at the end.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum EscrowEvent {
    SwapStatusChanged(SwapStatusChange),
}

pub mod c2c_escrow {
    use super::*;

    #[derive(Serialize, Deserialize, Clone, Debug)]
    pub struct Args {
        pub events: Vec<IdempotentEnvelope<EscrowEvent>>,
    }

    pub type Response = SuccessOnly;
}

pub fn deposit_subaccount(principal: Principal, swap_id: u32) -> Subaccount {
    let mut bytes = Vec::new();
    bytes.extend_from_slice(principal.as_slice());
    bytes.extend_from_slice(&swap_id.to_be_bytes());
    sha256(&bytes)
}
