use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, MessageContent, MessageId, MessageIndex};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
}

#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    UserNotInCommunity,
    ChannelNotFound,
    UserNotInChannel,
    NotAuthorized,
    MessageNotFound,
    MessageNotDeleted,
    MessageHardDeleted,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub content: MessageContent,
}
