use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, MessageContentInitial, MessageId, MessageIndex};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: MessageContentInitial,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    MessageNotFound,
    CallerNotInCommunity,
    UserNotInChannel,
    UserSuspended,
    CommunityFrozen,
    ChannelNotFound,
}
