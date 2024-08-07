use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, MessageContentInitial, MessageId, MessageIndex};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: MessageContentInitial,
    pub block_level_markdown: Option<bool>,
    pub new_achievement: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    MessageNotFound,
    UserNotInCommunity,
    UserNotInChannel,
    UserSuspended,
    CommunityFrozen,
    ChannelNotFound,
}
