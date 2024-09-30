use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, GroupRole, UserId};

#[ts_export(community, change_channel_role)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub user_id: UserId,
    pub new_role: GroupRole,
}

#[ts_export(community, change_channel_role)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CommunityFrozen,
    UserNotInCommunity,
    UserSuspended,
    ChannelNotFound,
    UserNotInChannel,
    TargetUserNotInChannel,
    NotAuthorized,
    Invalid,
    UserLapsed,
}
