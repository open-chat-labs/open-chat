use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::ChatId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, delete_frozen_group)]
pub struct Args {
    pub chat_id: ChatId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, delete_frozen_group)]
pub enum Response {
    Success,
    ChatNotFrozen,
    ChatNotFound,
    NotAuthorized,
    InternalError(String),
}
