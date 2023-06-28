use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::ChannelId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub to_add: Vec<ChannelId>,
    pub to_remove: Vec<ChannelId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    PartialSucesss(FailedChannels),
    Failed(FailedChannels),
    CommunityFrozen,
    UserNotInCommunity,
    UserSuspended,
    NotAuthorized,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct FailedChannels {
    pub not_found: Vec<ChannelId>,
    pub private: Vec<ChannelId>,
}
