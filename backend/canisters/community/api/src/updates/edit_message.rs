use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, MessageContentInitial, MessageId, MessageIndex};

#[ts_export(community, edit_message)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: MessageContentInitial,
    pub block_level_markdown: Option<bool>,
    pub new_achievement: bool,
}

#[ts_export(community, edit_message)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    MessageNotFound,
    UserNotInCommunity,
    UserNotInChannel,
    UserSuspended,
    CommunityFrozen,
    ChannelNotFound,
    UserLapsed,
    Error(OCError),
}
