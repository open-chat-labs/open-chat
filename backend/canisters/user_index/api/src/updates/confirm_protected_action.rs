use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

// Confirms (and immediately executes) a pending protected action. The confirmer must be a
// different platform operator than the proposer, and the proposal must not have expired.
#[ts_export(user_index, confirm_protected_action)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub action_id: u64,
}

pub type Response = UnitResult;
