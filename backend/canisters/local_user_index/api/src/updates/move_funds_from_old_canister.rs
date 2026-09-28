use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CanisterId, UserId};

// Moves the funds held by the canister of the id the caller had before being migrated to a
// MultiUser canister, on each of the given ledgers, to the caller's wallet
#[ts_export(local_user_index, move_funds_from_old_canister)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub old_user_id: UserId,
    #[ts(as = "Vec::<ts_export::TSPrincipal>")]
    pub ledgers: Vec<CanisterId>,
}

#[ts_export(local_user_index, move_funds_from_old_canister)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    // The outcome on each of the ledgers given, in no particular order
    Success(Vec<LedgerOutcome>),
    Error(OCError),
}

#[ts_export(local_user_index, move_funds_from_old_canister)]
#[derive(Serialize, Deserialize, Debug)]
pub struct LedgerOutcome {
    pub ledger: CanisterId,
    pub result: MoveFundsResult,
}

#[ts_export(local_user_index, move_funds_from_old_canister)]
#[derive(Serialize, Deserialize, Debug)]
pub enum MoveFundsResult {
    // `amount` arrived in the caller's wallet, the ledger having charged `fee` on top
    Moved { amount: u128, fee: u128, block_index: u64 },
    // The balance didn't exceed the ledger's fee, so there was nothing to move
    NothingToMove,
    Failed(OCError),
}
