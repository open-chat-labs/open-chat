use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageId, MessageIndex, UnitResult};

#[ts_export(group, delete_messages)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_ids: Vec<MessageId>,
    pub as_platform_moderator: Option<bool>,
    pub new_achievement: bool,
    pub correlation_id: u64,
}

pub type Response = UnitResult;
