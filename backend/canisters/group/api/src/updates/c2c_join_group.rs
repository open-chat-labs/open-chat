use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{GroupCanisterGroupChatSummary, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub principal: Principal,
    pub as_super_admin: bool,
    pub invite_code: Option<u64>,
    pub correlation_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Box<GroupCanisterGroupChatSummary>),
    AlreadyInGroup,
    GroupNotPublic,
    Blocked,
    ParticipantLimitReached(u32),
    ChatFrozen,
}
