use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, MessageId, MessageIndex, Reaction};

#[ts_export(community, remove_reaction)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub reaction: Reaction,
}

#[ts_export(community, remove_reaction)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NoChange,
    MessageNotFound,
    ChannelNotFound,
    UserNotInCommunity,
    UserNotInChannel,
    NotAuthorized,
    UserSuspended,
    CommunityFrozen,
    UserLapsed,
}
