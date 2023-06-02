use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, MessageIndex, PushEventResult};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub message_index: MessageIndex,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(PushEventResult),
    CommunityFrozen,
    UserNotInCommunity,
    UserSuspended,
    ChannelNotFound,
    UserNotInChannel,
    MessageNotFound,
    NotAuthorized,
    NoChange,
}
