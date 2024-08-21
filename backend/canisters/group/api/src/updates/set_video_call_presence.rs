use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageId, VideoCallPresence};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub presence: VideoCallPresence,
    pub new_achievement: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    MessageNotFound,
    AlreadyEnded,
    GroupFrozen,
    UserNotInGroup,
    UserSuspended,
}
