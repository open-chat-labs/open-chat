use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub caller: UserId,
    pub channel_id: ChannelId,
    pub user_ids: Vec<UserId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    PartialSuccess(PartialSuccessResult),
    Failed(FailedResult),
    CommunityFrozen,
    UserNotInCommunity,
    ChannelNotFound,
    UserNotInChannel,
    UserSuspended,
    NotAuthorized,
    TooManyInvites(u32),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub invited_users: Vec<UserId>,
    pub community_name: String,
    pub channel_name: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct PartialSuccessResult {
    pub invited_users: Vec<UserId>,
    pub community_name: String,
    pub channel_name: String,
    pub users_not_in_community: Vec<UserId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct FailedResult {
    pub users_not_in_community: Vec<UserId>,
}
