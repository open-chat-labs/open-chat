use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::ChatId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, add_hot_group_exclusion)]
pub struct Args {
    pub chat_id: ChatId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, add_hot_group_exclusion)]
pub enum Response {
    Success,
    ChatAlreadyExcluded,
    ChatNotFound,
    NotAuthorized,
    InternalError(String),
}
