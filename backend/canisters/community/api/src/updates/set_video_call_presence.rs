use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, MessageId, UnitResult, VideoCallPresence};

#[ts_export(community, set_video_call_presence)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub message_id: MessageId,
    pub presence: VideoCallPresence,
    pub new_achievement: bool,
}

pub type Response = UnitResult;
