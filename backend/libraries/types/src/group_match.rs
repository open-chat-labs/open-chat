use crate::{AccessGate, ChannelId, ChatId, CommunityId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct GroupMatch {
    pub id: ChatId,
    // TODO: Remove this once the FE is using id
    pub chat_id: ChatId,
    pub name: String,
    pub description: String,
    pub avatar_id: Option<u128>,
    pub member_count: u32,
    pub gate: Option<AccessGate>,
}

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
    pub moderation_flags: u32,
    pub primary_language: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ChannelMatch {
    pub id: ChannelId,
    pub name: String,
    pub description: String,
    pub avatar_id: Option<u128>,
    pub member_count: u32,
    pub gate: Option<AccessGate>,
    pub is_default: bool,
}
