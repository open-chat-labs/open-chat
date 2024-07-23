use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, CommunityId, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
    pub start: TimestampMillis,
    pub main_chat_fund: u128,
    pub main_chit_band: u32,
    pub lottery_prizes: Vec<u128>,
    pub lottery_chit_band: u32,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    ChannelUsed,
    InThePast,
    ClashesWithPrevious,
}
