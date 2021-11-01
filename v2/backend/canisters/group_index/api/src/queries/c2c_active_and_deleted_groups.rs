use candid::CandidType;
use serde::Deserialize;
use types::{ChatId, DeletedGroupInfo, Milliseconds};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub chat_ids: Vec<ChatId>,
    pub active_in_last: Milliseconds,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub active_groups: Vec<ChatId>,
    pub deleted_groups: Vec<DeletedGroupInfo>,
}
