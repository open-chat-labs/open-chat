use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export(user_index, pay_for_premium_item)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub item_id: u32,
    pub pay_in_chat: bool,
    pub expected_cost: u32,
}

#[ts_export(user_index, pay_for_premium_item)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(user_index, pay_for_premium_item)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub total_chit_earned: i32,
    pub chit_balance: i32,
}
