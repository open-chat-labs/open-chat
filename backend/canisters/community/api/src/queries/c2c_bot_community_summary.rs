use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{
    AccessGateConfig, BotInitiator, ChannelId, CommunityId, CommunityPermissions, EventIndex, FrozenGroupInfo, TimestampMillis,
    UserId, VersionedRules,
};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: BotInitiator,
}

#[expect(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(CommunitySummary),
    Error(OCError),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunitySummary {
    pub community_id: CommunityId,
    pub last_updated: TimestampMillis,
    pub name: String,
    pub description: String,
    pub avatar_id: Option<u128>,
    pub banner_id: Option<u128>,
    pub is_public: bool,
    pub verified: bool,
    pub member_count: u32,
    pub permissions: CommunityPermissions,
    pub public_channels: Vec<ChannelSummary>,
    pub rules: VersionedRules,
    pub frozen: Option<FrozenGroupInfo>,
    pub gate_config: Option<AccessGateConfig>,
    pub primary_language: String,
    pub latest_event_index: EventIndex,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ChannelSummary {
    pub channel_id: ChannelId,
    pub last_updated: TimestampMillis,
    pub name: String,
}
