use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};

#[derive(CandidType, Serialize, Deserialize, Debug, Default, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct EventIndex(u32);

impl EventIndex {
    pub fn incr(&self) -> EventIndex {
        EventIndex(self.0.saturating_add(1))
    }

    pub fn decr(&self) -> EventIndex {
        EventIndex(self.0.saturating_sub(1))
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

impl From<EventIndex> for usize {
    fn from(event_index: EventIndex) -> Self {
        event_index.0.try_into().unwrap()
    }
}

impl From<EventIndex> for u64 {
    fn from(event_index: EventIndex) -> Self {
        event_index.0.into()
    }
}

impl Display for EventIndex {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}
