use candid::CandidType;
use serde::Deserialize;
use types::{ChatId, MessageMatch, UserId};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub search_term: String,
    pub max_results: u8,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    UserNotInGroup,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub chat_id: ChatId,
    pub matches: Vec<MessageMatch>,
}
