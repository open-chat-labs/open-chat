use candid::CandidType;
use ts_export::ts_export;
use types::ChatId;

#[ts_export(user, delete_group)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub chat_id: ChatId,
}

#[ts_export(user, delete_group)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    UserSuspended,
    ChatFrozen,
    InternalError(String),
}
