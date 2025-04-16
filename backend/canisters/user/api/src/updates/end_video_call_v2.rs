use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageId, UnitResult, UserId};

#[ts_export(user, end_video_call)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct Args {
    pub user_id: UserId,
    pub message_id: MessageId,
}

pub type Response = UnitResult;
