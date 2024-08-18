use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;
use types::{ChatId, EventWrapper, GroupFrozen, Milliseconds};

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, freeze_group)]
pub struct Args {
    pub chat_id: ChatId,
    #[ts(optional)]
    pub reason: Option<String>,
    #[ts(optional)]
    pub suspend_members: Option<SuspensionDetails>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, freeze_group)]
pub struct SuspensionDetails {
    #[ts(optional)]
    pub duration: Option<Milliseconds>,
    pub reason: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(group_index, freeze_group)]
pub enum Response {
    Success(#[ts(as = "types::EventWrapperGroupFrozen")] EventWrapper<GroupFrozen>),
    ChatAlreadyFrozen,
    ChatNotFound,
    NotAuthorized,
    InternalError(String),
}
