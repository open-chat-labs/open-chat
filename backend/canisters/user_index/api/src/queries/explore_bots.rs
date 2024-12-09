use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::BotMatch;

#[ts_export(user_index, explore_bots)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub search_term: Option<String>,
    pub page_index: u32,
    pub page_size: u8,
}

#[ts_export(user_index, explore_bots)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    TermTooShort(u8),
    TermTooLong(u8),
    InvalidTerm,
}

#[ts_export(user_index, explore_bots)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub matches: Vec<BotMatch>,
    pub total: u32,
}
