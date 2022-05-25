use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatId, ChatSummary, Cycles, TimestampMillis, UserId, Version};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    InternalError(String),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub chats: Vec<ChatSummary>,
    pub blocked_users: Vec<UserId>,
    pub cycles_balance: Cycles,
    pub upgrades_in_progress: Vec<ChatId>,
    pub user_canister_wasm_version: Version,
}
