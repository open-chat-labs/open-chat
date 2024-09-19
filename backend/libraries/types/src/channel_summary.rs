use crate::{
    AccessGate, AccessGateConfig, ChannelId, ChatMetrics, EventIndex, EventWrapper, GroupMembership, GroupMembershipUpdates,
    GroupPermissions, GroupSubtype, Message, MessageIndex, Milliseconds, OptionUpdate, TimestampMillis, VideoCall,
};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
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
    pub messages_visible_to_non_members: bool,
    pub min_visible_event_index: EventIndex,
    pub min_visible_message_index: MessageIndex,
    #[ts(as = "Option<crate::EventWrapperMessage>")]
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_message_sender_display_name: Option<String>,
    pub latest_event_index: EventIndex,
    pub latest_message_index: Option<MessageIndex>,
    pub member_count: u32,
    pub permissions_v2: GroupPermissions,
    pub metrics: ChatMetrics,
    pub date_last_pinned: Option<TimestampMillis>,
    pub events_ttl: Option<Milliseconds>,
    pub events_ttl_last_updated: TimestampMillis,
    pub gate: Option<AccessGate>,
    pub gate_config: Option<AccessGateConfig>,
    pub membership: Option<GroupMembership>,
    pub video_call_in_progress: Option<VideoCall>,
    pub is_invited: Option<bool>,
    pub external_url: Option<String>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityCanisterChannelSummaryUpdates {
    pub channel_id: ChannelId,
    pub last_updated: TimestampMillis,
    pub name: Option<String>,
    pub description: Option<String>,
    #[ts(as = "crate::OptionUpdateGroupSubtype")]
    pub subtype: OptionUpdate<GroupSubtype>,
    #[ts(as = "crate::OptionUpdateU128")]
    pub avatar_id: OptionUpdate<u128>,
    pub is_public: Option<bool>,
    pub messages_visible_to_non_members: Option<bool>,
    #[ts(as = "Option<crate::EventWrapperMessage>")]
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_message_sender_display_name: Option<String>,
    pub latest_event_index: Option<EventIndex>,
    pub latest_message_index: Option<MessageIndex>,
    pub member_count: Option<u32>,
    pub permissions_v2: Option<GroupPermissions>,
    pub updated_events: Vec<(Option<MessageIndex>, EventIndex, TimestampMillis)>, // (Thread root message index, event index, timestamp)
    pub metrics: Option<ChatMetrics>,
    pub date_last_pinned: Option<TimestampMillis>,
    #[ts(as = "crate::OptionUpdateU64")]
    pub events_ttl: OptionUpdate<Milliseconds>,
    pub events_ttl_last_updated: Option<TimestampMillis>,
    #[ts(as = "crate::OptionUpdateAccessGate")]
    pub gate: OptionUpdate<AccessGate>,
    #[ts(as = "crate::OptionUpdateAccessGateConfig")]
    pub gate_config: OptionUpdate<AccessGateConfig>,
    pub membership: Option<GroupMembershipUpdates>,
    #[ts(as = "crate::OptionUpdateVideoCall")]
    pub video_call_in_progress: OptionUpdate<VideoCall>,
    #[ts(as = "crate::OptionUpdateString")]
    pub external_url: OptionUpdate<String>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ChannelLatestMessageIndex {
    pub channel_id: ChannelId,
    pub latest_message_index: Option<MessageIndex>,
}
