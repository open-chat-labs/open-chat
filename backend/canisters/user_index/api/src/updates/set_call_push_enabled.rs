use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

#[ts_export(user_index, set_call_push_enabled)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub enabled: bool,
}

pub type Response = UnitResult;
