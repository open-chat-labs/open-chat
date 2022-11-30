use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatId, DeletedGroupInfo, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_ids: Vec<ChatId>,
    pub active_since: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub active_groups: Vec<ChatId>,
    pub deleted_groups: Vec<DeletedGroupInfo>,
    pub upgrades_in_progress: Vec<ChatId>,
}
