use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CommunityGroupId, Message, MessageId, MessageIndex};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub group_id: CommunityGroupId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_ids: Vec<MessageId>,
    pub correlation_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    MessageNotFound,
    GroupNotFound,
    CallerNotInCommunity,
    UserNotInGroup,
    UserSuspended,
    ChatFrozen,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub messages: Vec<Message>,
}
