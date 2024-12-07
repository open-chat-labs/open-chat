use crate::model::events::CommunityEventInternal;
use candid::Deserialize;
use serde::Serialize;
use stable_memory_map::{with_map_mut, CommunityEventKeyPrefix};
use types::EventWrapperInternal;

#[derive(Serialize, Deserialize)]
pub struct EventsStableStorage {
    prefix: CommunityEventKeyPrefix,
}

impl Default for EventsStableStorage {
    fn default() -> Self {
        EventsStableStorage {
            prefix: CommunityEventKeyPrefix::new(),
        }
    }
}

impl EventsStableStorage {
    pub fn insert(&mut self, event: EventWrapperInternal<CommunityEventInternal>) {
        with_map_mut(|m| m.insert(self.prefix.create_key(event.index).into(), event_to_bytes(event)));
    }
}

fn event_to_bytes(event: EventWrapperInternal<CommunityEventInternal>) -> Vec<u8> {
    msgpack::serialize_then_unwrap(event)
}
