use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, MessageIndex};

#[ts_export(community, follow_thread)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: MessageIndex,
    pub new_achievement: bool,
}

#[ts_export(community, follow_thread)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    AlreadyFollowing,
    ThreadNotFound,
    ChannelNotFound,
    UserNotInChannel,
    UserNotInCommunity,
    UserSuspended,
    CommunityFrozen,
    UserLapsed,
    Error(OCError),
}
