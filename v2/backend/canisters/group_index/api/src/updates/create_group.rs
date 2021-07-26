use candid::{CandidType, Principal};
use serde::Deserialize;
use shared::types::chat_id::GroupChatId;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub is_public: bool,
    pub creator_principal: Principal,
    pub name: String,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success(SuccessResult),
    NameTaken,
    CyclesBalanceTooLow,
    InternalError,
}

#[derive(CandidType, Deserialize)]
pub struct SuccessResult {
    pub group_id: GroupChatId,
}
