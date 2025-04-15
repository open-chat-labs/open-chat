use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{EmptySuccessOrError, MessageId, Milliseconds, UserId, VideoCallType};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub initiator: UserId,
    pub initiator_username: String,
    pub initiator_display_name: Option<String>,
    pub max_duration: Option<Milliseconds>,
    pub call_type: VideoCallType,
}

pub type Response = EmptySuccessOrError;
