use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{EventWrapper, Message, MessageIndex, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub threads: Vec<MessageIndex>,
    pub latest_client_thread_update: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    CallerNotInGroup,
    ReplicaNotUpToDate(TimestampMillis),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub threads: Vec<ThreadPreview>,
    pub timestamp: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ThreadPreview {
    pub root_message: EventWrapper<Message>,
    pub latest_replies: Vec<EventWrapper<Message>>,
    pub total_replies: u32,
}
