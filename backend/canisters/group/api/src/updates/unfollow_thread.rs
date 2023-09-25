use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, MessageIndex};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: MessageIndex,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotFollowing,
    ThreadNotFound,
    UserNotInGroup,
    UserSuspended,
    GroupFrozen,
}
