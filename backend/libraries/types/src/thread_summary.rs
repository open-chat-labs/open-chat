use std::collections::HashSet;

use crate::{EventIndex, TimestampMillis, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ThreadSummary {
    pub participant_ids: Vec<UserId>,
    pub reply_count: u32,
    pub latest_event_index: EventIndex,
    pub latest_event_timestamp: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct ThreadSummaryInternal {
    pub participant_ids: HashSet<UserId>,
    pub reply_count: u32,
    pub latest_event_index: EventIndex,
    pub latest_event_timestamp: TimestampMillis,
}

impl From<ThreadSummaryInternal> for ThreadSummary {
    fn from(c: ThreadSummaryInternal) -> Self {
        ThreadSummary {
            participant_ids: c.participant_ids.iter().copied().collect(),
            reply_count: c.reply_count,
            latest_event_index: c.latest_event_index,
            latest_event_timestamp: c.latest_event_timestamp,
        }
    }
}
