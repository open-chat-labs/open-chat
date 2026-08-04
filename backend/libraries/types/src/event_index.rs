use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
use ts_export::ts_export;

pub const MIN_EVENT_INDEX: EventIndex = EventIndex(0);
pub const MAX_EVENT_INDEX: EventIndex = EventIndex(u32::MAX);

#[ts_export]
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

#[cfg(test)]
mod tests {
    use super::*;

    // candid 0.10.28 - 0.10.33 could not decode this: the bulk fast path added for vecs of
    // primitives fed elements through deserializers with no `deserialize_newtype_struct`, so a
    // `Vec` of any newtype struct failed to decode its own encoding. It traps whole endpoints
    // rather than failing loudly in one place, so it is worth pinning here.
    // See https://github.com/dfinity/candid/issues/752
    #[test]
    fn vec_survives_a_candid_round_trip() {
        let original = vec![EventIndex::from(1), EventIndex::from(10)];

        let encoded = candid::encode_one(&original).unwrap();
        let decoded: Vec<EventIndex> = candid::decode_one(&encoded).unwrap();

        assert_eq!(decoded, original);
    }
}
