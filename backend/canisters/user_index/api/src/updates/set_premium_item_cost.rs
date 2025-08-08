use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

#[ts_export(user_index, set_premium_item_cost)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub item_id: u32,
    pub chit_cost: u32,
}

pub type Response = UnitResult;
