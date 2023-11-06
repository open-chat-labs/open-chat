use crate::{
    AccessGate, ChannelId, ChatMetrics, EventIndex, EventWrapper, GroupCanisterThreadDetails, GroupPermissions, GroupRole,
    GroupSubtype, HydratedMention, Message, MessageIndex, Milliseconds, OptionUpdate, TimestampMillis,
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
    pub latest_message_sender_display_name: Option<String>,
    pub latest_event_index: EventIndex,
    pub latest_message_index: Option<MessageIndex>,
    pub member_count: u32,
    pub permissions_v2: GroupPermissions,
    pub metrics: ChatMetrics,
    pub date_last_pinned: Option<TimestampMillis>,
    pub events_ttl: Option<Milliseconds>,
    pub gate: Option<AccessGate>,
    pub membership: Option<ChannelMembership>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ChannelMembership {
    pub joined: TimestampMillis,
    pub role: GroupRole,
    pub mentions: Vec<HydratedMention>,
    pub notifications_muted: bool,
    pub my_metrics: ChatMetrics,
    pub latest_threads: Vec<GroupCanisterThreadDetails>,
    pub rules_accepted: bool,
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
    pub latest_message_sender_display_name: Option<String>,
    pub latest_event_index: Option<EventIndex>,
    pub latest_message_index: Option<MessageIndex>,
    pub member_count: Option<u32>,
    pub permissions_v2: Option<GroupPermissions>,
    pub updated_events: Vec<(Option<MessageIndex>, EventIndex, TimestampMillis)>, // (Thread root message index, event index, timestamp)
    pub metrics: Option<ChatMetrics>,
    pub date_last_pinned: Option<TimestampMillis>,
    pub events_ttl: OptionUpdate<Milliseconds>,
    pub gate: OptionUpdate<AccessGate>,
    pub membership: Option<ChannelMembershipUpdates>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ChannelMembershipUpdates {
    pub role: Option<GroupRole>,
    pub mentions: Vec<HydratedMention>,
    pub notifications_muted: Option<bool>,
    pub my_metrics: Option<ChatMetrics>,
    pub latest_threads: Vec<GroupCanisterThreadDetails>,
    pub unfollowed_threads: Vec<MessageIndex>,
    pub rules_accepted: Option<bool>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ChannelLatestMessageIndex {
    pub channel_id: ChannelId,
    pub latest_message_index: Option<MessageIndex>,
}
