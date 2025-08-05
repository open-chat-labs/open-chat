use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

#[ts_export(user_index, pay_for_premium_item)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub item_id: u32,
    pub pay_in_chat: bool,
    pub expected_cost: u32,
}

pub type Response = UnitResult;
