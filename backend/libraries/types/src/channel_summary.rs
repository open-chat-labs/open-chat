use crate::{
    AccessGate, ChannelId, ChatMetrics, EventIndex, EventWrapper, GroupCanisterThreadDetails, GroupPermissions, GroupRole,
    GroupSubtype, Mention, Message, MessageIndex, Milliseconds, OptionUpdate, RangeSet, TimestampMillis,
};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityCanisterChannelSummary {
    pub channel_id: ChannelId,
    pub last_updated: TimestampMillis,
    pub name: String,
    pub description: String,
    pub subtype: Option<GroupSubtype>,
    pub avatar_id: Option<u128>,
    pub is_public: bool,
    pub history_visible_to_new_joiners: bool,
    pub min_visible_event_index: EventIndex,
    pub min_visible_message_index: MessageIndex,
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: EventIndex,
    pub joined: TimestampMillis,
    pub member_count: u32,
    pub role: GroupRole,
    pub mentions: Vec<Mention>,
    pub permissions: GroupPermissions,
    pub notifications_muted: bool,
    pub metrics: ChatMetrics,
    pub my_metrics: ChatMetrics,
    pub latest_threads: Vec<GroupCanisterThreadDetails>,
    pub date_last_pinned: Option<TimestampMillis>,
    pub events_ttl: Option<Milliseconds>,
    pub expired_messages: RangeSet<MessageIndex>,
    pub next_message_expiry: Option<TimestampMillis>,
    pub gate: Option<AccessGate>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityCanisterChannelSummaryUpdates {
    pub channel_id: ChannelId,
    pub last_updated: TimestampMillis,
    pub name: Option<String>,
    pub description: Option<String>,
    pub subtype: OptionUpdate<GroupSubtype>,
    pub avatar_id: OptionUpdate<u128>,
    pub is_public: Option<bool>,
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: Option<EventIndex>,
    pub member_count: Option<u32>,
    pub role: Option<GroupRole>,
    pub mentions: Vec<Mention>,
    pub permissions: Option<GroupPermissions>,
    pub notifications_muted: Option<bool>,
    pub metrics: Option<ChatMetrics>,
    pub my_metrics: Option<ChatMetrics>,
    pub latest_threads: Vec<GroupCanisterThreadDetails>,
    pub date_last_pinned: Option<TimestampMillis>,
    pub events_ttl: OptionUpdate<Milliseconds>,
    pub gate: OptionUpdate<AccessGate>,
}
