use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub user_id: UserId,
}

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
}
