use candid::{CandidType, Principal};
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{
    GateCheckFailedReason, GroupCanisterGroupChatSummary, TimestampMillis, UniquePersonProof, UserId, UserType,
    VerifiedCredentialGateArgs,
};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub principal: Principal,
    pub invite_code: Option<u64>,
    pub correlation_id: u64,
    pub is_platform_moderator: bool,
    pub user_type: UserType,
    pub diamond_membership_expires_at: Option<TimestampMillis>,
    pub verified_credential_args: Option<VerifiedCredentialGateArgs>,
    pub unique_person_proof: Option<UniquePersonProof>,
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
    Error(OCError),
}
