use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{ChannelId, ChatId, CommunityId, MessageIndex, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub messages_read: Vec<ChatMessagesRead>,
    pub community_messages_read: Vec<CommunityMessagesRead>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ChatMessagesRead {
    pub chat_id: ChatId,
    pub read_up_to: Option<MessageIndex>,
    pub threads: Vec<ThreadRead>,
    pub date_read_pinned: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ThreadRead {
    pub root_message_index: MessageIndex,
    pub read_up_to: MessageIndex,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct CommunityMessagesRead {
    pub community_id: CommunityId,
    pub channels_read: HashMap<ChannelId, ChannelMessagesRead>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ChannelMessagesRead {
    pub channel_id: ChannelId,
    pub read_up_to: Option<MessageIndex>,
    pub threads: Vec<ThreadRead>,
    pub date_read_pinned: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
