use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChatId, UserId};

#[ts_export(local_user_index, invite_users_to_group)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub group_id: ChatId,
    pub user_ids: Vec<UserId>,
    pub caller_username: String,
    pub correlation_id: u64,
}

#[ts_export(local_user_index, invite_users_to_group)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    GroupNotFound,
    CallerNotInGroup,
    NotAuthorized,
    ChatFrozen,
    TooManyInvites(u32),
    InternalError(String),
    Error(OCError),
}
