use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, GroupRole, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub user_id: UserId,
    pub new_role: GroupRole,
}

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
}
