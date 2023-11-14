use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, MessageIndex, MessagesResponse, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub messages: Vec<MessageIndex>,
    pub latest_known_update: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(MessagesResponse),
    UserNotInCommunity,
    UserNotInChannel,
    ChannelNotFound,
    ThreadNotFound,
    ReplicaNotUpToDateV2(TimestampMillis),
}
