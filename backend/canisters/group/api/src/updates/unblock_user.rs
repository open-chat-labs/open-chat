use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UserId;

#[ts_export(group, unblock_user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub correlation_id: u64,
}

#[ts_export(group, unblock_user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CallerNotInGroup,
    CannotUnblockSelf,
    GroupNotPublic,
    NotAuthorized,
    UserSuspended,
    UserLapsed,
    ChatFrozen,
}
