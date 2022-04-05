use candid::{CandidType, Principal};
use serde::Deserialize;
use types::GroupChatSummaryInternal;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub principal: Principal,
    pub as_super_admin: bool,
}

#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(GroupChatSummaryInternal),
    AlreadyInGroup,
    GroupNotPublic,
    Blocked,
    ParticipantLimitReached(u32),
    NotSuperAdmin,
    InternalError(String),
}
