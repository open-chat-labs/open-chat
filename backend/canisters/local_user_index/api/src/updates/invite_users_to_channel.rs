use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, CommunityId, UserId};

#[ts_export(local_user_index, invite_users_to_channel)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
    pub user_ids: Vec<UserId>,
    pub caller_username: String,
}

#[ts_export(local_user_index, invite_users_to_channel)]
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
    UserLapsed,
    NotAuthorized,
    TooManyInvites(u32),
    InternalError(String),
    Error(u16, Option<String>),
}

#[ts_export(local_user_index, invite_users_to_channel)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct PartialSuccessResult {
    pub failed_users: Vec<UserId>,
}

#[ts_export(local_user_index, invite_users_to_channel)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct FailedResult {
    pub failed_users: Vec<UserId>,
}
