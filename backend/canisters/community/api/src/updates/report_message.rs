use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, MessageId, MessageIndex};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub delete: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CommunityFrozen,
    UserNotInCommunity,
    UserSuspended,
    ChannelNotFound,
    NotAuthorized,
    UserNotInChannel,
    MessageNotFound,
    AlreadyReported,
    InternalError(String),
}
