use crate::{AccessGate, ChannelId, EventIndex, GroupPermissions, GroupRole, TimestampMillis};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ChannelSummary {
    pub channel_id: ChannelId,
    pub name: String,
    pub description: String,
    pub avatar_id: Option<u128>,
    pub is_public: bool,
    pub joined: TimestampMillis,
    pub member_count: u32,
    pub role: GroupRole,
    pub permissions: GroupPermissions,
    pub gate: Option<AccessGate>,
    pub last_updated: TimestampMillis,
    pub latest_event_index: EventIndex,
}
