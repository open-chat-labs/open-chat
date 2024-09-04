use candid::CandidType;
use ts_export::ts_export;
use types::{CommunityCanisterCommunitySummary, CommunityId, GateCheckFailedReason, UserId, VerifiedCredentialGateArgs};

#[ts_export(local_user_index, join_community)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub community_id: CommunityId,
    pub invite_code: Option<u64>,
    pub referred_by: Option<UserId>,
    pub verified_credential_args: Option<VerifiedCredentialGateArgs>,
}

#[ts_export(local_user_index, join_community)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(Box<CommunityCanisterCommunitySummary>),
    AlreadyInCommunity(Box<CommunityCanisterCommunitySummary>),
    GateCheckFailed(GateCheckFailedReason),
    CommunityNotFound,
    CommunityNotPublic,
    NotInvited,
    MemberLimitReached(u32),
    UserBlocked,
    UserSuspended,
    CommunityFrozen,
    InternalError(String),
}
