use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChatId, EventWrapper, GroupFrozen, Milliseconds};

#[ts_export(group_index, freeze_group)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_id: ChatId,
    pub reason: Option<String>,
    pub suspend_members: Option<SuspensionDetails>,
}

#[ts_export(group_index, freeze_group)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuspensionDetails {
    pub duration: Option<Milliseconds>,
    pub reason: String,
}

#[ts_export(group_index, freeze_group)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(#[ts(as = "types::EventWrapperGroupFrozen")] EventWrapper<GroupFrozen>),
    ChatAlreadyFrozen,
    ChatNotFound,
    NotAuthorized,
    InternalError(String),
}
