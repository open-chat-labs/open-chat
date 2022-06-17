use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{DirectChatEvent, EventIndex, EventWrapper, MessageIndex, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub from_index: EventIndex,
    pub to_index: EventIndex,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    ChatNotFound,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub events: Vec<EventWrapper<DirectChatEvent>>,
    pub affected_events: Vec<EventWrapper<DirectChatEvent>>,
}
