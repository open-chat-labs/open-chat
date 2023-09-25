use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::MessageIndex;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: MessageIndex,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    AlreadyFollowing,
    ThreadNotFound,
    UserNotInGroup,
    UserSuspended,
    GroupFrozen,
}
