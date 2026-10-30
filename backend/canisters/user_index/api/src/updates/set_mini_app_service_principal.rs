use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

#[ts_export(user_index, set_mini_app_service_principal)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub principal: Principal,
}

pub type Response = UnitResult;
