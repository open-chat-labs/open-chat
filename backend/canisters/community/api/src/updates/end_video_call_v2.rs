use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, EmptySuccessOrError, MessageId};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct Args {
    pub channel_id: ChannelId,
    pub message_id: MessageId,
}

pub type Response = EmptySuccessOrError;
