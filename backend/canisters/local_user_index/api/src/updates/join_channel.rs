use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{
    ChannelId, CommunityCanisterChannelSummary, CommunityCanisterCommunitySummary, CommunityId, GateCheckFailedReason, UserId,
    VerifiedCredentialGateArgs,
};

#[ts_export(local_user_index, join_channel)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
    pub invite_code: Option<u64>,
    pub referred_by: Option<UserId>,
    pub verified_credential_args: Option<VerifiedCredentialGateArgs>,
}

#[ts_export(local_user_index, join_channel)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Box<CommunityCanisterChannelSummary>),
    SuccessJoinedCommunity(Box<CommunityCanisterCommunitySummary>),
    AlreadyInChannel(Box<CommunityCanisterChannelSummary>),
    GateCheckFailed(GateCheckFailedReason),
    CommunityNotFound,
    CommunityNotPublic,
    ChannelNotFound,
    MemberLimitReached(u32),
    UserBlocked,
    UserSuspended,
    CommunityFrozen,
    NotInvited,
    InternalError(String),
    Error(OCError),
}
