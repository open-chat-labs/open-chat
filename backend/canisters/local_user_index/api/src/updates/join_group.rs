use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatId, GateCheckFailedReason, GroupCanisterGroupChatSummary};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_id: ChatId,
    pub invite_code: Option<u64>,
    pub correlation_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Box<GroupCanisterGroupChatSummary>),
    AlreadyInGroup,
    AlreadyInGroupV2(Box<GroupCanisterGroupChatSummary>),
    GateCheckFailed(GateCheckFailedReason),
    GroupNotFound,
    GroupNotPublic,
    ParticipantLimitReached(u32),
    Blocked,
    UserSuspended,
    ChatFrozen,
    InternalError(String),
}
