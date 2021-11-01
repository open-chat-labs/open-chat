use candid::CandidType;
use serde::Deserialize;
use types::{ChatId, DeletedGroupInfo};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub chat_ids: Vec<ChatId>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub deleted_groups: Vec<DeletedGroupInfo>,
}
