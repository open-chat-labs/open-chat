use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, MessageId};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct Args {
    pub channel_id: ChannelId,
    pub message_id: MessageId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    MessageNotFound,
    AlreadyEnded,
}
