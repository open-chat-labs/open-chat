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
    pub participants_added_or_updated: Vec<Participant>,
    pub participants_removed: Vec<UserId>,
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: Option<EventIndex>,
    pub read_by_me: Option<Vec<MessageIndexRange>>,
}

impl From<SummaryUpdates> for GroupChatSummaryUpdates {
    fn from(s: SummaryUpdates) -> Self {
        GroupChatSummaryUpdates {
            chat_id: s.chat_id,
            last_updated: s.last_updated,
            name: s.name,
            description: s.description,
            avatar_id: s.avatar_id,
            participants_added_or_updated: s.participants_added_or_updated,
            participants_removed: s.participants_removed,
            latest_message: s.latest_message,
            latest_event_index: s.latest_event_index,
            read_by_me: s.read_by_me,
            notifications_muted: None,
        }
    }
}
