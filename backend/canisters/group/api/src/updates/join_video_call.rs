use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{EmptySuccessOrError, MessageId, VideoCallPresence};

#[ts_export(group, join_video_call)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub new_achievement: bool,
}

pub type Response = EmptySuccessOrError;

impl From<Args> for crate::set_video_call_presence::Args {
    fn from(value: Args) -> Self {
        crate::set_video_call_presence::Args {
            message_id: value.message_id,
            presence: VideoCallPresence::Default,
            new_achievement: value.new_achievement,
        }
    }
}
