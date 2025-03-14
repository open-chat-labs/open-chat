use candid::{CandidType, Principal};
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{
    CommunityCanisterCommunitySummary, GateCheckFailedReason, TimestampMillis, UniquePersonProof, UserId, UserType,
    VerifiedCredentialGateArgs,
};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub principal: Principal,
    pub invite_code: Option<u64>,
    pub referred_by: Option<UserId>,
    pub is_platform_moderator: bool,
    #[deprecated]
    #[serde(default)]
    pub is_bot: bool,
    pub user_type: UserType,
    pub diamond_membership_expires_at: Option<TimestampMillis>,
    pub verified_credential_args: Option<VerifiedCredentialGateArgs>,
    pub unique_person_proof: Option<UniquePersonProof>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Box<CommunityCanisterCommunitySummary>),
    AlreadyInCommunity(Box<CommunityCanisterCommunitySummary>),
    GateCheckFailed(GateCheckFailedReason),
    NotInvited,
    UserBlocked,
    MemberLimitReached(u32),
    CommunityFrozen,
    InternalError(String),
    Error(OCError),
}
