use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CanisterId, UserId};

// Moves the funds held by the canister of the id the caller had before being migrated to a
// MultiUser canister, on each of the given ledgers (at most 20), to the caller's wallet. Must be
// called on the LocalUserIndex which controls that canister, once it has been uninstalled. Only
// ledgers known to the Registry are moved from, the others failing with `LedgerNotFound`.
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
    // The balance didn't exceed the fee, as known to the Registry, or as the ledger gave when it
    // rejected that fee, so there was nothing to move
    NothingToMove,
    // If the transfer timed out (a `C2CError` with reject code 6, `SYS_UNKNOWN`) it may still have
    // been made, in which case a later call finds nothing left to move
    Failed(OCError),
}
