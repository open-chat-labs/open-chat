use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::ExchangeId;

#[ts_export(registry, add_remove_swap_provider)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub swap_provider: ExchangeId,
    pub add: bool,
}

#[ts_export(registry, add_remove_swap_provider)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    InternalError(String),
}
