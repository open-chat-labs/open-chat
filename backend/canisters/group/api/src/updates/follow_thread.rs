use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::MessageIndex;

#[ts_export(group, follow_thread)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: MessageIndex,
}

#[ts_export(group, follow_thread)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    AlreadyFollowing,
    ThreadNotFound,
    UserNotInGroup,
    UserSuspended,
    UserLapsed,
    GroupFrozen,
}
