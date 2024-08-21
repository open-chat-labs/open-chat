use crate::{TimestampMillis, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

pub type FrozenCommunityInfo = FrozenGroupInfo;

#[derive(CandidType, Serialize, Deserialize, Debug, Clone, TS)]
pub struct FrozenGroupInfo {
    pub timestamp: TimestampMillis,
    pub frozen_by: UserId,
    #[ts(optional)]
    pub reason: Option<String>,
}
