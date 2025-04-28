use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

#[ts_export(group, delete_webhook)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub id: Principal,
}

pub type Response = UnitResult;
