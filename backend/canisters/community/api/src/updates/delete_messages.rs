use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, EmptySuccessOrError, MessageId, MessageIndex};

#[ts_export(community, delete_messages)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_ids: Vec<MessageId>,
    pub as_platform_moderator: Option<bool>,
    pub new_achievement: bool,
}

pub type Response = EmptySuccessOrError;
