use candid::CandidType;
use ts_export::ts_export;
use types::{ChannelId, CommunityId, UserId};

#[ts_export(local_user_index, invite_users_to_channel)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
    pub user_ids: Vec<UserId>,
    pub caller_username: String,
}

#[ts_export(local_user_index, invite_users_to_channel)]
#[derive(CandidType, Debug)]
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

#[ts_export(local_user_index, invite_users_to_channel)]
#[derive(CandidType, Debug)]
pub struct PartialSuccessResult {
    pub failed_users: Vec<UserId>,
}

#[ts_export(local_user_index, invite_users_to_channel)]
#[derive(CandidType, Debug)]
pub struct FailedResult {
    pub failed_users: Vec<UserId>,
}
