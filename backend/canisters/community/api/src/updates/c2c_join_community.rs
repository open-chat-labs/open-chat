use ic_principal::Principal;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{
    ChannelId, CommunityCanisterCommunitySummary, GateCheckFailedReason, TimestampMillis, UniquePersonProof, UserId, UserType,
    VerifiedCredentialGateArgs,
};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub principal: Principal,
    pub channel_id: Option<ChannelId>,
    pub invite_code: Option<u64>,
    pub referred_by: Option<UserId>,
    pub is_platform_moderator: bool,
    pub user_type: UserType,
    pub diamond_membership_expires_at: Option<TimestampMillis>,
    pub verified_credential_args: Option<VerifiedCredentialGateArgs>,
    pub unique_person_proof: Option<UniquePersonProof>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Box<CommunityCanisterCommunitySummary>),
    AlreadyInCommunity(Box<CommunityCanisterCommunitySummary>),
    GateCheckFailed(GateCheckFailedReason),
    Error(OCError),
}
