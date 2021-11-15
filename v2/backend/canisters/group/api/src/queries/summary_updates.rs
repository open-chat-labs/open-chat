use candid::CandidType;
use serde::Deserialize;
use types::*;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub updates_since: TimestampMillis,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    SuccessNoUpdates,
    CallerNotInGroup,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub updates: SummaryUpdates,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct SummaryUpdates {
    pub chat_id: ChatId,
    pub last_updated: TimestampMillis,
    pub name: Option<String>,
    pub description: Option<String>,
    pub avatar_id: Option<u128>,
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: Option<EventIndex>,
    pub participant_count: Option<u32>,
    pub role: Option<Role>,
    pub mentions: Vec<Mention>,
    pub wasm_version: Option<Version>,
}

impl From<SummaryUpdates> for GroupChatSummaryUpdates {
    fn from(s: SummaryUpdates) -> Self {
        GroupChatSummaryUpdates {
            chat_id: s.chat_id,
            last_updated: s.last_updated,
            name: s.name,
            description: s.description,
            avatar_id: s.avatar_id,
            latest_message: s.latest_message,
            latest_event_index: s.latest_event_index,
            participant_count: s.participant_count,
            role: s.role,
            read_by_me: None,
            notifications_muted: None,
            mentions: s.mentions,
            wasm_version: s.wasm_version,
        }
    }
}
