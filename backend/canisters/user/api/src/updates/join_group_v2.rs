use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatId, GroupChatSummary};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_id: ChatId,
    pub as_super_admin: bool,
    pub invite_code: Option<u64>,
    pub correlation_id: u64,
}

#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(GroupChatSummary),
    AlreadyInGroup,
    GroupNotFound,
    GroupNotPublic,
    ParticipantLimitReached(u32),
    Blocked,
    InternalError(String),
    NotSuperAdmin,
}
