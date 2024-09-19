use crate::{AccessGate, AccessGateConfig, ChannelId, ChatId, CommunityId, GroupSubtype};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct GroupMatch {
    pub id: ChatId,
    pub name: String,
    pub description: String,
    pub avatar_id: Option<u128>,
    pub member_count: u32,
    pub gate: Option<AccessGate>,
    pub subtype: Option<GroupSubtype>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct CommunityMatch {
    pub id: CommunityId,
    pub score: u32,
    pub name: String,
    pub description: String,
    pub avatar_id: Option<u128>,
    pub banner_id: Option<u128>,
    pub member_count: u32,
    pub channel_count: u32,
    pub gate: Option<AccessGate>,
    pub gate_config: Option<AccessGateConfig>,
    pub moderation_flags: u32,
    pub primary_language: String,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ChannelMatch {
    pub id: ChannelId,
    pub name: String,
    pub description: String,
    pub avatar_id: Option<u128>,
    pub member_count: u32,
    pub gate: Option<AccessGate>,
    pub gate_config: Option<AccessGateConfig>,
    pub subtype: Option<GroupSubtype>,
}
