use candid::CandidType;
use ts_export::ts_export;
use types::{ChatId, EventWrapper, GroupUnfrozen};

#[ts_export(group_index, unfreeze_group)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub chat_id: ChatId,
}

#[ts_export(group_index, unfreeze_group)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(#[ts(as = "types::EventWrapperGroupUnfrozen")] EventWrapper<GroupUnfrozen>),
    ChatNotFrozen,
    ChatNotFound,
    NotAuthorized,
    InternalError(String),
}
