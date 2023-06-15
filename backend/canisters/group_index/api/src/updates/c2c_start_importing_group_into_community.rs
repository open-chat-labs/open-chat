use serde::{Deserialize, Serialize};
use types::{ChatId, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub group_id: ChatId,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(u64),
    GroupNotFound,
    AlreadyImportingToAnotherCommunity,
    UserNotInGroup,
    UserNotGroupOwner,
    UserSuspended,
    ChatFrozen,
    InternalError(String),
}
