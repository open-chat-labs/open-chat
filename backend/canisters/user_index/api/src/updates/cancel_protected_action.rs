use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

// Cancels a pending protected action. Any platform operator can cancel - including the
// proposer - so a proposal made with a compromised key can be killed by whoever notices it.
#[ts_export(user_index, cancel_protected_action)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub action_id: u64,
}

pub type Response = UnitResult;
