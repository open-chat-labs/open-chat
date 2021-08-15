use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug, Default, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct EventIndex(u32);

impl EventIndex {
    pub fn incr(&self) -> EventIndex {
        EventIndex(self.0 + 1)
    }
}

impl From<u32> for EventIndex {
    fn from(val: u32) -> Self {
        EventIndex(val)
    }
}

impl From<EventIndex> for u32 {
    fn from(event_index: EventIndex) -> Self {
        event_index.0
    }
}
