use serde::{Deserialize, Serialize};
use types::{CanisterId, SuccessOnly};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub ledger_canister_id: CanisterId,
    pub enabled: bool,
}

pub type Response = SuccessOnly;
