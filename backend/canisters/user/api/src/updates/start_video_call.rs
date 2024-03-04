use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageId, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub initiator: UserId,
    pub sender_name: String,
    pub sender_avatar_id: Option<u128>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(crate::send_message_v2::SuccessResult),
    InternalError(String),
    NotAuthorized,
}
