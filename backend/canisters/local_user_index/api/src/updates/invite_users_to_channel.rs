use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, CommunityId, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
    pub user_ids: Vec<UserId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    PartialSuccess(PartialSuccessResult),
    Failed(FailedResult),
    CommunityFrozen,
    UserNotInCommunity,
    ChannelNotFound,
    UserNotInChannel,
    UserSuspended,
    NotAuthorized,
    TooManyInvites(u32),
    InternalError(String),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct PartialSuccessResult {
    pub users_not_in_community: Vec<UserId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct FailedResult {
    pub users_not_in_community: Vec<UserId>,
}
