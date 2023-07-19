use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{ChannelId, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub caller: UserId,
    pub channel_id: ChannelId,
    pub users: Vec<(UserId, Principal)>,
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
    pub failed_users: Vec<UserId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct FailedResult {
    pub failed_users: Vec<UserId>,
}
