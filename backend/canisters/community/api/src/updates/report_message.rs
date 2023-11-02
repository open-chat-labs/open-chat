use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, MessageId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub message_id: MessageId,
    pub reason_code: u32,
    pub notes: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CommunityFrozen,
    UserNotInCommunity,
    ChannelNotFound,
    UserNotInChannel,
    MessageNotFound,
    InternalError(String),
}
