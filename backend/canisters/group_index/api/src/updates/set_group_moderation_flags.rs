use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::ChatId;

#[ts_export(group_index, set_group_moderation_flags)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub group_id: ChatId,
    pub flags: u32,
}

#[ts_export(group_index, set_group_moderation_flags)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Unchanged,
    GroupNotFound,
    NotAuthorized,
    InvalidFlags,
    InternalError(String),
}
