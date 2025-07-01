use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageId, UnitResult, VideoCallPresence};

#[ts_export(group, set_video_call_presence)]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub presence: VideoCallPresence,
    pub new_achievement: bool,
}

pub type Response = UnitResult;
