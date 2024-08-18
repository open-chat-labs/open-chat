use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::{ChatId, EventWrapper, GroupUnfrozen};

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, unfreeze_group)]
pub struct Args {
    pub chat_id: ChatId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, unfreeze_group)]
pub enum Response {
    Success(#[ts(as = "types::EventWrapperGroupUnfrozen")] EventWrapper<GroupUnfrozen>),
    ChatNotFrozen,
    ChatNotFound,
    NotAuthorized,
    InternalError(String),
}
