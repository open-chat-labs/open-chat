use crate::{TimestampMillis, UserId};
use candid::CandidType;
use ts_export::ts_export;

pub type FrozenCommunityInfo = FrozenGroupInfo;

#[ts_export]
#[derive(CandidType, Debug, Clone)]
pub struct FrozenGroupInfo {
    pub timestamp: TimestampMillis,
    pub frozen_by: UserId,
    pub reason: Option<String>,
}
