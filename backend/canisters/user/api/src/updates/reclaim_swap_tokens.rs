use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CanisterId, ExchangeId};

#[ts_export(user, reclaim_swap_tokens)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub exchange_id: ExchangeId,
    pub swap_canister_id: CanisterId,
    pub ledger_canister_id: CanisterId,
    pub amount: u128,
    pub fee: u128,
}

#[ts_export(user, reclaim_swap_tokens)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Failed(String),
    Error(OCError),
}
