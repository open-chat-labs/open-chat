use crate::{AccessGate, ChatId, CommunityId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct GroupMatch {
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
    pub name: String,
    pub description: String,
    pub avatar_id: Option<u128>,
    pub banner_id: Option<u128>,
    pub member_count: u32,
    pub channel_count: u32,
    pub gate: Option<AccessGate>,
}
