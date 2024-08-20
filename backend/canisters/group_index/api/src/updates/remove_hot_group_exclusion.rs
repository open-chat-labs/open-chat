use candid::CandidType;
use ts_export::ts_export;
use types::ChatId;

#[ts_export(group_index, remove_hot_group_exclusion)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub chat_id: ChatId,
}

#[ts_export(group_index, remove_hot_group_exclusion)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    ChatNotExcluded,
    ChatNotFound,
    NotAuthorized,
    InternalError(String),
}
