use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, MessageId, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub message_id: MessageId,
    pub initiator: UserId,
    pub initiator_username: String,
    pub initiator_display_name: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
}
