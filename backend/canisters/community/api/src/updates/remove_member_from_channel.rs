use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, UserId};

#[ts_export(community, remove_member_from_channel)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub user_id: UserId,
}

#[ts_export(community, remove_member_from_channel)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CommunityFrozen,
    UserNotInCommunity,
    TargetUserNotInCommunity,
    UserSuspended,
    ChannelNotFound,
    UserNotInChannel,
    TargetUserNotInChannel,
    CannotRemoveSelf,
    NotAuthorized,
    UserLapsed,
    Error(OCError),
}
