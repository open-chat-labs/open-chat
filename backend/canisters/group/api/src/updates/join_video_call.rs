use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageId, VideoCallPresence};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
}

pub type Response = crate::set_video_call_presence::Response;

impl From<Args> for crate::set_video_call_presence::Args {
    fn from(value: Args) -> Self {
        crate::set_video_call_presence::Args {
            message_id: value.message_id,
            presence: VideoCallPresence::Default,
        }
    }
}
