mod lifecycle;
mod updates;

use candid::CandidType;
pub use lifecycle::*;
pub use updates::*;

use serde::{Deserialize, Serialize};
use types::{ChannelId, CommunityId, TimestampMillis};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(from = "AirdropConfigPrev")]
pub struct AirdropConfig {
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
    pub start: TimestampMillis,
    pub algorithm: AirdropAlgorithm,
}

// TODO: Remove this after next release
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AirdropConfigPrev {
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
    pub start: TimestampMillis,
    pub main_chat_fund: u128,
    pub main_chit_band: u32,
    pub lottery_prizes: Vec<u128>,
    pub lottery_chit_band: u32,
}

impl From<AirdropConfigPrev> for AirdropConfig {
    fn from(value: AirdropConfigPrev) -> Self {
        AirdropConfig {
            community_id: value.community_id,
            channel_id: value.channel_id,
            start: value.start,
            algorithm: AirdropAlgorithm::V1(V1Algorithm {
                main_chat_fund: value.main_chat_fund,
                main_chit_band: value.main_chit_band,
                lottery_prizes: value.lottery_prizes,
                lottery_chit_band: value.lottery_chit_band,
            }),
        }
    }
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
}
