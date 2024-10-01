use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, MessageId, VideoCallPresence};

#[ts_export(community, join_video_call)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub message_id: MessageId,
    pub new_achievement: bool,
}

pub type Response = crate::set_video_call_presence::Response;

impl From<Args> for crate::set_video_call_presence::Args {
    fn from(value: Args) -> Self {
        crate::set_video_call_presence::Args {
            channel_id: value.channel_id,
            message_id: value.message_id,
            presence: VideoCallPresence::Default,
            new_achievement: value.new_achievement,
        }
    }
}
