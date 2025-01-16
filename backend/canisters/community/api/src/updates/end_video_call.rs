use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, MessageId};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct Args {
    pub channel_id: u128,
    pub message_id: u128,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct ArgsV2 {
    pub channel_id: ChannelId,
    pub message_id: MessageId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    MessageNotFound,
    AlreadyEnded,
}

impl From<Args> for ArgsV2 {
    fn from(value: Args) -> Self {
        ArgsV2 {
            channel_id: value.channel_id.into(),
            message_id: value.message_id.into(),
        }
    }
}
