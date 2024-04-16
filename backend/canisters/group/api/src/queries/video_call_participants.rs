use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageId, TimestampMillis, VideoCallParticipants};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub updated_since: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(VideoCallParticipants),
    VideoCallNotFound,
    CallerNotInGroup,
}
