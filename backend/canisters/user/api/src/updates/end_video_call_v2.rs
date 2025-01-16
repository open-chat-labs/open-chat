use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageId, UserId};

#[ts_export(user, end_video_call)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct ArgsV1 {
    pub user_id: UserId,
    pub message_id: u128,
}

#[ts_export(user, end_video_call)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct Args {
    pub user_id: UserId,
    pub message_id: MessageId,
}

#[ts_export(user, end_video_call)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    MessageNotFound,
    AlreadyEnded,
}

impl From<ArgsV1> for Args {
    fn from(value: ArgsV1) -> Self {
        Args {
            user_id: value.user_id,
            message_id: value.message_id.into(),
        }
    }
}
