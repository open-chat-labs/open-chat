use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CommunityGroupId, MessageContentInitial, MessageId, MessageIndex};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub group_id: CommunityGroupId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: MessageContentInitial,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    MessageNotFound,
    CallerNotInCommunity,
    UserNotInGroup,
    UserSuspended,
    CommunityFrozen,
    GroupNotFound,
}
