use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::CanisterId;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    // The ledger of every token the canister may hold a balance of
    pub ledgers: Vec<LedgerToSweep>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LedgerToSweep {
    pub ledger_canister_id: CanisterId,
    pub fee: u128,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    // The ledgers whose balance couldn't be read or moved, for which the call should be retried
    pub failed: Vec<CanisterId>,
}
