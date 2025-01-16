use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageId, Milliseconds, UserId, VideoCallType};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub initiator: UserId,
    pub initiator_username: String,
    pub initiator_display_name: Option<String>,
    pub max_duration: Option<Milliseconds>,
    pub call_type: VideoCallType,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ArgsV2 {
    pub message_id: MessageId,
    pub initiator: UserId,
    pub initiator_username: String,
    pub initiator_display_name: Option<String>,
    pub max_duration: Option<Milliseconds>,
    pub call_type: VideoCallType,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
}

impl From<Args> for ArgsV2 {
    fn from(value: Args) -> Self {
        ArgsV2 {
            message_id: value.message_id.into(),
            initiator: value.initiator,
            initiator_username: value.initiator_username,
            initiator_display_name: value.initiator_display_name,
            max_duration: value.max_duration,
            call_type: value.call_type,
        }
    }
}
