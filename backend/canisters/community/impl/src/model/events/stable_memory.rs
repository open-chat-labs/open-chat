use crate::model::events::{CommunityEventInternal, CommunityEventInternalOld};
use candid::Deserialize;
use serde::Serialize;
use stable_memory_map::{with_map, with_map_mut, CommunityEventKeyPrefix, KeyPrefix};
use types::{EventIndex, EventWrapperInternal};

#[derive(Serialize, Deserialize, Default)]
pub struct EventsStableStorage {
    prefix: CommunityEventKeyPrefix,
}

impl EventsStableStorage {
    pub fn read_all(&self) -> Vec<EventWrapperInternal<CommunityEventInternalOld>> {
        with_map(|m| {
            m.range(self.prefix.create_key(&EventIndex::default())..)
                .map(|(_, bytes)| msgpack::deserialize_then_unwrap(&bytes))
                .collect()
        })
    }

    pub fn insert(&mut self, event: EventWrapperInternal<CommunityEventInternal>) {
        with_map_mut(|m| m.insert(self.prefix.create_key(&event.index), event_to_bytes(event)));
    }
}

fn event_to_bytes(event: EventWrapperInternal<CommunityEventInternal>) -> Vec<u8> {
    msgpack::serialize_then_unwrap(event)
}
