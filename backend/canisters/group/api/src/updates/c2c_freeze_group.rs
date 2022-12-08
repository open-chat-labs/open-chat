use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatFrozen, EventWrapper, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub caller: UserId,
    pub reason: Option<String>,
    pub return_members: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(EventWrapper<ChatFrozen>),
    SuccessWithMembers(EventWrapper<ChatFrozen>, Vec<UserId>),
    ChatAlreadyFrozen,
}
