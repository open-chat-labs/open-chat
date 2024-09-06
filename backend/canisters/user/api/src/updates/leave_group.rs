use candid::CandidType;
use ts_export::ts_export;
use types::ChatId;

#[ts_export(user, leave_group)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub chat_id: ChatId,
    pub correlation_id: u64,
}

#[ts_export(user, leave_group)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    GroupNotFound,
    GroupNotPublic,
    CallerNotInGroup,
    OwnerCannotLeave,
    UserSuspended,
    ChatFrozen,
    InternalError(String),
}
