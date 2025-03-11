mod lifecycle;
mod updates;

use candid::CandidType;
pub use lifecycle::*;
pub use updates::*;

use serde::{Deserialize, Serialize};
use types::{ChannelId, CommunityId, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AirdropConfig {
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
    pub start: TimestampMillis,
    pub algorithm: AirdropAlgorithm,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum AirdropAlgorithm {
    V1(V1Algorithm),
    V2(V2Algorithm),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct V1Algorithm {
    pub main_chat_fund: u128,
    pub main_chit_band: u32,
    pub lottery_prizes: Vec<u128>,
    pub lottery_chit_band: u32,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct V2Algorithm {
    pub main_chat_fund: u128,
    pub main_chit_band: u32,
    pub lottery_prizes: Vec<u128>,
    pub lottery_min_chit: u32,
    pub lottery_min_streak: u16,
    #[serde(default)]
    pub min_minutes_online: u16,
}
