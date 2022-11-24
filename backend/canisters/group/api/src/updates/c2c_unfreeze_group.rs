use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatUnfrozen, EventWrapper, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub caller: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(EventWrapper<ChatUnfrozen>),
    ChatNotFrozen,
}
