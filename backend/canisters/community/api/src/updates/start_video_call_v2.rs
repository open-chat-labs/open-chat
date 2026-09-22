use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, MessageId, Milliseconds, UnitResult, UserId, VideoCallType};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub message_id: MessageId,
    pub initiator: UserId,
    pub initiator_username: String,
    pub initiator_display_name: Option<String>,
    pub max_duration: Option<Milliseconds>,
    pub call_type: VideoCallType,
    // None from a video bridge that predates audio calls
    #[serde(default)]
    pub audio_only: Option<bool>,
}

pub type Response = UnitResult;
