use crate::{EventIndex, TimestampMillis, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct ThreadSummary {
    pub participant_ids: Vec<UserId>,
    pub followed_by_me: bool,
    pub reply_count: u32,
    pub latest_event_index: EventIndex,
    pub latest_event_timestamp: TimestampMillis,
}
