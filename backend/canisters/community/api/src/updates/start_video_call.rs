use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, MessageId, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub message_id: MessageId,
    pub initiator: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(crate::send_message::SuccessResult),
    NotAuthorized,
}
