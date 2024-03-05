use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageId, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub initiator: UserId,
    pub initiator_username: String,
    pub initiator_display_name: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(crate::send_message_v2::SuccessResult),
    NotAuthorized,
}
