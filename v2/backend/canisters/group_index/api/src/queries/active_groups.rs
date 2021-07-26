use candid::CandidType;
use serde::Deserialize;
use shared::types::chat_id::GroupChatId;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub group_ids: Vec<GroupChatId>,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Deserialize)]
pub struct SuccessResult {
    pub active_groups: Vec<GroupChatId>,
}
