use crate::{TimestampMillis, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

pub type FrozenCommunityInfo = FrozenGroupInfo;

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct FrozenGroupInfo {
    pub timestamp: TimestampMillis,
    pub frozen_by: UserId,
    pub reason: Option<String>,
}
