use candid::{CandidType, Nat, Principal};
use icrc_ledger_types::icrc1::account::Subaccount;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct Args {
    pub owner: Option<Principal>,
    pub subaccount: Option<Subaccount>,
}

// The id of the queued deposit, which is that of the deposit already in flight if there is one
pub type Response = Result<u64, DepositSolError>;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum DepositSolError {
    InsufficientCycles(InsufficientCyclesError),
    TemporarilyUnavailable(String),
    AlreadyProcessing,
    // The balance of the deposit address is below the minimum deposit amount
    ValueTooSmall { balance: u64, minimum_deposit_amount: u64 },
    // The account's latest deposit can't be credited until the minter is upgraded
    Quarantined { deposit_id: u64 },
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct InsufficientCyclesError {
    pub expected: Nat,
    pub received: Nat,
}
