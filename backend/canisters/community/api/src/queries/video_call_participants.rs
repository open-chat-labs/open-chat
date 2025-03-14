use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, MessageId, TimestampMillis, VideoCallParticipants};

#[ts_export(community, video_call_participants)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub message_id: MessageId,
    pub updated_since: Option<TimestampMillis>,
}

#[ts_export(community, video_call_participants)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(VideoCallParticipants),
    VideoCallNotFound,
    UserNotInCommunity,
    UserNotInChannel,
    ChannelNotFound,
    Error(OCError),
}
