use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, ChatId, CommunityId, MessageIndex, TimestampMillis};

#[ts_export(user, mark_read)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub messages_read: Vec<ChatMessagesRead>,
    pub community_messages_read: Vec<CommunityMessagesRead>,
    pub message_activity_feed: Option<TimestampMillis>,
}

#[ts_export(user, mark_read)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ChatMessagesRead {
    pub chat_id: ChatId,
    pub read_up_to: Option<MessageIndex>,
    pub threads: Vec<ThreadRead>,
    pub date_read_pinned: Option<TimestampMillis>,
}

#[ts_export(user, mark_read)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ThreadRead {
    pub root_message_index: MessageIndex,
    pub read_up_to: MessageIndex,
}

#[ts_export(user, mark_read)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct CommunityMessagesRead {
    pub community_id: CommunityId,
    pub channels_read: Vec<ChannelMessagesRead>,
}

#[ts_export(user, mark_read)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ChannelMessagesRead {
    pub channel_id: ChannelId,
    pub read_up_to: Option<MessageIndex>,
    pub threads: Vec<ThreadRead>,
    pub date_read_pinned: Option<TimestampMillis>,
}

#[ts_export(user, mark_read)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
