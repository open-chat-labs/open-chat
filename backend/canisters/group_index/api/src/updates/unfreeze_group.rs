use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChatId, EventWrapper, GroupUnfrozen};

#[ts_export(group_index, unfreeze_group)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_id: ChatId,
}

#[ts_export(group_index, unfreeze_group)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(#[ts(as = "types::EventWrapperGroupUnfrozen")] EventWrapper<GroupUnfrozen>),
    ChatNotFrozen,
    ChatNotFound,
    NotAuthorized,
    InternalError(String),
    Error(OCError),
}
