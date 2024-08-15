use crate::{AirdropAlgorithm, AirdropConfig};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChannelId, CommunityId, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
    pub start: TimestampMillis,
    pub algorithm: AirdropAlgorithm,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    ChannelUsed,
    InThePast,
    ClashesWithPrevious,
}

impl From<Args> for AirdropConfig {
    fn from(value: Args) -> Self {
        AirdropConfig {
            community_id: value.community_id,
            channel_id: value.channel_id,
            start: value.start,
            algorithm: value.algorithm,
        }
    }
}
