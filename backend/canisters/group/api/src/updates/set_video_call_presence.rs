use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageId, VideoCallPresence};

#[ts_export(group, set_video_call_presence)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub presence: VideoCallPresence,
    pub new_achievement: bool,
}

#[ts_export(group, set_video_call_presence)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    MessageNotFound,
    AlreadyEnded,
    GroupFrozen,
    UserNotInGroup,
    UserSuspended,
    UserLapsed,
    Error(u16, Option<String>),
}
