use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{GateCheckFailedReason, GroupCanisterGroupChatSummary, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub principal: Principal,
    pub invite_code: Option<u64>,
    pub correlation_id: u64,
    pub is_platform_moderator: bool,
    pub is_bot: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Box<GroupCanisterGroupChatSummary>),
    AlreadyInGroup,
    AlreadyInGroupV2(Box<GroupCanisterGroupChatSummary>),
    GateCheckFailed(GateCheckFailedReason),
    GroupNotPublic,
    NotInvited,
    Blocked,
    ParticipantLimitReached(u32),
    ChatFrozen,
    InternalError(String),
}
