mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;

use candid::CandidType;
use serde::Deserialize;
use types::{
    ChatId, EventIndex, EventWrapper, GroupChatSummary, GroupPermissions, Mention, Message, MessageIndex, Role,
    TimestampMillis, UserId, Version,
};

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Summary {
    pub chat_id: ChatId,
    pub last_updated: TimestampMillis,
    pub name: String,
    pub description: String,
    pub avatar_id: Option<u128>,
    pub is_public: bool,
    pub min_visible_event_index: EventIndex,
    pub min_visible_message_index: MessageIndex,
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: EventIndex,
    pub joined: TimestampMillis,
    pub participant_count: u32,
    pub role: Role,
    pub mentions: Vec<Mention>,
    pub pinned_message: Option<MessageIndex>,
    pub wasm_version: Version,
    pub owner_id: UserId,
    pub permissions: GroupPermissions,
    pub notifications_muted: bool,
}

impl From<Summary> for GroupChatSummary {
    fn from(s: Summary) -> Self {
        GroupChatSummary {
            chat_id: s.chat_id,
            last_updated: s.last_updated,
            name: s.name,
            description: s.description,
            avatar_id: s.avatar_id,
            is_public: s.is_public,
            min_visible_event_index: s.min_visible_event_index,
            min_visible_message_index: s.min_visible_message_index,
            latest_message: s.latest_message,
            latest_event_index: s.latest_event_index,
            joined: s.joined,
            read_by_me: vec![],
            notifications_muted: s.notifications_muted,
            participant_count: s.participant_count,
            role: s.role,
            mentions: s.mentions,
            pinned_message: s.pinned_message,
            wasm_version: s.wasm_version,
            owner_id: s.owner_id,
            permissions: s.permissions,
        }
    }
}
