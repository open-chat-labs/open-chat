use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::ChatId;

#[ts_export(group_index, set_group_moderation_flags)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_id: ChatId,
    pub flags: u32,
}

#[ts_export(group_index, set_group_moderation_flags)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Unchanged,
    ChatNotFound,
    NotAuthorized,
    InvalidFlags,
    InternalError(String),
}
