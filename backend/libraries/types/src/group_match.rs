use crate::{AccessGate, ChannelId, ChatId, CommunityId, GroupSubtype};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
pub struct GroupMatch {
    pub id: ChatId,
    pub name: String,
    pub description: String,
    #[ts(optional)]
    pub avatar_id: Option<u128>,
    pub member_count: u32,
    #[ts(optional)]
    pub gate: Option<AccessGate>,
    #[ts(optional)]
    pub subtype: Option<GroupSubtype>,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
pub struct CommunityMatch {
    pub id: CommunityId,
    pub score: u32,
    pub name: String,
    pub description: String,
    #[ts(optional)]
    pub avatar_id: Option<u128>,
    #[ts(optional)]
    pub banner_id: Option<u128>,
    pub member_count: u32,
    pub channel_count: u32,
    #[ts(optional)]
    pub gate: Option<AccessGate>,
    pub moderation_flags: u32,
    pub primary_language: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
pub struct ChannelMatch {
    pub id: ChannelId,
    pub name: String,
    pub description: String,
    #[ts(optional)]
    pub avatar_id: Option<u128>,
    pub member_count: u32,
    #[ts(optional)]
    pub gate: Option<AccessGate>,
    #[ts(optional)]
    pub subtype: Option<GroupSubtype>,
}
