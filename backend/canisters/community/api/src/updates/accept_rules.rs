use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, Version};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub version: Version,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CommunityFrozen,
    UserSuspended,
    UserNotInCommunity,
    UserNotInChannel,
    ChannelNotFound,
    OldVersion,
    RulesAlreadyAccepted,
}
