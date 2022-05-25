use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatId, DeletedGroupInfo, Milliseconds};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_ids: Vec<ChatId>,
    pub active_in_last: Option<Milliseconds>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub active_groups: Vec<ChatId>,
    pub deleted_groups: Vec<DeletedGroupInfo>,
    pub upgrades_in_progress: Vec<ChatId>,
}
