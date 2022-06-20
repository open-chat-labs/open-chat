use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{EventIndex, EventWrapper, GroupChatEvent, MessageIndex};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub start_index: EventIndex,
    pub ascending: bool,
    pub max_events: u32,
    pub invite_code: Option<u64>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    CallerNotInGroup,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub events: Vec<EventWrapper<GroupChatEvent>>,
    pub affected_events: Vec<EventWrapper<GroupChatEvent>>,
    pub latest_event_index: EventIndex,
}
