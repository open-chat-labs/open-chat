use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct Args {
    pub owner: Option<Principal>,
}

pub type Response = Result<Vec<UtxoStatus>, UpdateBalanceError>;
pub type TimestampNanos = u64;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum UtxoStatus {
    // The minter ignored this UTXO because UTXO's value is too small to pay
    // the check fees.
    ValueTooSmall(Utxo),
    // The Bitcoin checker considered this UTXO to be tainted.
    Tainted(Utxo),
    // The UTXO passed the Bitcoin check, but the minter failed to mint ckBTC
    // because the Ledger was unavailable. Retrying the [update_balance] call
    // should eventually advance the UTXO to the [Minted] state.
    Checked(Utxo),
    // The UTXO passed the Bitcoin check, and ckBTC has been minted.
    Minted(MintedUtxo),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MintedUtxo {
    pub block_index: u64,
    pub minted_amount: u64,
    pub utxo: Utxo,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UtxoOutpoint {
    pub txid: Vec<u8>,
    pub vout: u32,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PendingUtxo {
    pub outpoint: UtxoOutpoint,
    pub value: u64,
    pub confirmations: u32,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum SuspendedReason {
    ValueTooSmall,
    Quarantined,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SuspendedUtxo {
    pub utxo: Utxo,
    pub reason: SuspendedReason,
    pub earliest_retry: TimestampNanos,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Utxo {
    pub outpoint: UtxoOutpoint,
    pub value: u64,
    pub height: u32,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct NoNewUtxosError {
    pub current_confirmations: Option<u32>,
    pub required_confirmations: u32,
    pub pending_utxos: Option<Vec<PendingUtxo>>,
    pub suspended_utxos: Option<Vec<SuspendedUtxo>>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GenericError {
    pub error_message: String,
    pub error_code: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum UpdateBalanceError {
    NoNewUtxos(NoNewUtxosError),
    AlreadyProcessing,
    TemporarilyUnavailable(String),
    GenericError(GenericError),
}
