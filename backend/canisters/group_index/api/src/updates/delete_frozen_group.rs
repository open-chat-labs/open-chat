use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::ChatId;

#[ts_export(group_index, delete_frozen_group)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_id: ChatId,
}

#[ts_export(group_index, delete_frozen_group)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    ChatNotFrozen,
    ChatNotFound,
    NotAuthorized,
    InternalError(String),
}
