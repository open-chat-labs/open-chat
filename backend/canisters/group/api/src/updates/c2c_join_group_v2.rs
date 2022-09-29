use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::GroupChatSummaryInternal;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub as_super_admin: bool,
    pub invite_code: Option<u64>,
    #[serde(default)]
    pub correlation_id: u64,
}

#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(GroupChatSummaryInternal),
    AlreadyInGroup,
    GroupNotPublic,
    Blocked,
    ParticipantLimitReached(u32),
    NotSuperAdmin,
    UserNotFound,
    InternalError(String),
}
