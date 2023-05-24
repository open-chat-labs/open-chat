use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, MessageId, MessageIndex, Reaction};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub reaction: Reaction,
    pub username: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NoChange,
    InvalidReaction,
    MessageNotFound,
    ChannelNotFound,
    NotAuthorized,
    CallerNotInCommunity,
    UserNotInChannel,
    UserSuspended,
    CommunityFrozen,
}
