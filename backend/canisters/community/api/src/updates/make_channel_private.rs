use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::ChannelId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CommunityFrozen,
    UserNotInCommunity,
    UserSuspended,
    ChannelNotFound,
    UserNotInChannel,
    NotAuthorized,
    ChannelIsDefault,
    AlreadyPrivate,
}
