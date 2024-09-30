use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, UserId};

#[ts_export(community, add_members_to_channel)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub user_ids: Vec<UserId>,
    pub added_by_name: String,
    pub added_by_display_name: Option<String>,
}

#[ts_export(community, add_members_to_channel)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    PartialSuccess(PartialSuccessResult),
    Failed(FailedResult),
    CommunityFrozen,
    CommunityPublic,
    UserSuspended,
    UserLapsed,
    UserNotInCommunity,
    UserNotInChannel,
    ChannelNotFound,
    UserLimitReached(u32),
    NotAuthorized,
    InternalError(String),
}

#[ts_export(community, add_members_to_channel)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct PartialSuccessResult {
    pub users_added: Vec<UserId>,
    pub users_already_in_channel: Vec<UserId>,
    pub users_limit_reached: Vec<UserId>,
    pub users_failed_with_error: Vec<UserFailedError>,
}

#[ts_export(community, add_members_to_channel)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct FailedResult {
    pub users_already_in_channel: Vec<UserId>,
    pub users_limit_reached: Vec<UserId>,
    pub users_failed_with_error: Vec<UserFailedError>,
}

#[ts_export(community, add_members_to_channel)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct UserFailedError {
    pub user_id: UserId,
    pub error: String,
}
