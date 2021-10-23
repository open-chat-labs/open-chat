use candid::CandidType;
use serde::Deserialize;
use types::{ChatSummary, Cycles, TimestampMillis, TransactionWrapper, UserId};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub chats: Vec<ChatSummary>,
    pub transactions: Vec<TransactionWrapper>,
    pub blocked_users: Vec<UserId>,
    pub cycles_balance: Cycles,
}
