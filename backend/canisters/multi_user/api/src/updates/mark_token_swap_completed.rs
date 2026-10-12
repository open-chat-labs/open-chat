use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

// Records how a swap recorded by `mark_token_swap_started` ended. Only the MultiUser canister
// implements this.
#[ts_export(user, mark_token_swap_completed)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub swap_id: u128,
    // The amount received if the swap went ahead, else why it didn't
    pub result: Result<u128, String>,
}

pub type Response = UnitResult;
