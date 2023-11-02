use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use tracing::trace;
use types::{
    AccessGate, ChatId, EventIndex, EventWrapper, Message, MessageIndex, Milliseconds, PublicGroupSummary, TimestampMillis,
};

#[derive(Serialize, Deserialize, Default)]
pub struct CachedHotGroups {
    groups: Vec<CachedPublicGroupSummary>,
    last_updated: TimestampMillis,
}

impl CachedHotGroups {
    pub fn get(&self, count: usize, exclusions: &HashSet<ChatId>) -> Vec<CachedPublicGroupSummary> {
        self.groups
            .iter()
            .filter(|g| !exclusions.contains(&g.chat_id))
            .take(count)
            .cloned()
            .collect()
    }

    pub fn update(&mut self, groups: Vec<CachedPublicGroupSummary>, now: TimestampMillis) {
        let chat_ids: Vec<_> = groups.iter().map(|g| g.chat_id).collect();

        self.groups = groups;
        self.last_updated = now;

        trace!(?chat_ids, "Cached hot groups updated");
    }

    pub fn remove(&mut self, chat_id: ChatId) {
        self.groups.retain(|g| g.chat_id != chat_id);
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(from = "CachedPublicGroupSummaryCombined")]
pub struct CachedPublicGroupSummary {
    pub chat_id: ChatId,
    pub last_updated: TimestampMillis,
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: EventIndex,
    pub latest_message_index: Option<MessageIndex>,
    pub participant_count: u32,
    pub events_ttl: Option<Milliseconds>,
    pub gate: Option<AccessGate>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CachedPublicGroupSummaryCombined {
    pub chat_id: ChatId,
    pub last_updated: TimestampMillis,
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: EventIndex,
    #[serde(default)]
    pub latest_message_index: Option<MessageIndex>,
    pub participant_count: u32,
    pub events_ttl: Option<Milliseconds>,
    pub gate: Option<AccessGate>,
}

impl From<CachedPublicGroupSummaryCombined> for CachedPublicGroupSummary {
    fn from(value: CachedPublicGroupSummaryCombined) -> Self {
        let latest_message_index = value
            .latest_message_index
            .or_else(|| value.latest_message.as_ref().map(|m| m.event.message_index));

        CachedPublicGroupSummary {
            chat_id: value.chat_id,
            last_updated: value.last_updated,
            latest_message: value.latest_message,
            latest_event_index: value.latest_event_index,
            latest_message_index,
            participant_count: value.participant_count,
            events_ttl: value.events_ttl,
            gate: value.gate,
        }
    }
}

impl From<PublicGroupSummary> for CachedPublicGroupSummary {
    fn from(summary: PublicGroupSummary) -> Self {
        CachedPublicGroupSummary {
            chat_id: summary.chat_id,
            last_updated: summary.last_updated,
            latest_message: summary.latest_message,
            latest_event_index: summary.latest_event_index,
            latest_message_index: summary.latest_message_index,
            participant_count: summary.participant_count,
            events_ttl: summary.events_ttl,
            gate: summary.gate,
        }
    }
}
