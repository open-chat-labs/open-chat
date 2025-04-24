use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

#[ts_export(group, register_webhook)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub name: String,
    pub avatar: Option<String>,
}

pub type Response = UnitResult;
