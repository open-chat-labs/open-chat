use candid::CandidType;
use serde::Deserialize;
use types::{ChatId, EventIndex, EventWrapper, Message, MessageIndex, TimestampMillis, Version};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub summary: PublicGroupSummary,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct PublicGroupSummary {
    pub chat_id: ChatId,
    pub last_updated: TimestampMillis,
    pub name: String,
    pub description: String,
    pub avatar_id: Option<u128>,
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: EventIndex,
    pub participant_count: u32,
    pub pinned_message: Option<MessageIndex>,
    pub wasm_version: Version,
}
