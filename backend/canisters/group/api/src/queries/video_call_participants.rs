use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageId, TimestampMillis, VideoCallParticipants};

#[ts_export(group, video_call_participants)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub updated_since: Option<TimestampMillis>,
}

#[ts_export(group, video_call_participants)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(VideoCallParticipants),
    VideoCallNotFound,
    CallerNotInGroup,
    Error(u16, Option<String>),
}
