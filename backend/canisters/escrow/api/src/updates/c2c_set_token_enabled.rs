use serde::{Deserialize, Serialize};
use types::CanisterId;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub ledger_canister_id: CanisterId,
    pub enabled: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
