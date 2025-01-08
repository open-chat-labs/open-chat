use crate::model::events::CommunityEventInternal;
use candid::Deserialize;
use serde::Serialize;
use stable_memory_map::{with_map_mut, CommunityEventKeyPrefix, KeyPrefix};
use types::EventWrapperInternal;

#[derive(Serialize, Deserialize, Default)]
pub struct EventsStableStorage {
    prefix: CommunityEventKeyPrefix,
}

impl EventsStableStorage {
    pub fn insert(&mut self, event: EventWrapperInternal<CommunityEventInternal>) {
        with_map_mut(|m| m.insert(self.prefix.create_key(&event.index), event_to_bytes(event)));
    }
}

fn event_to_bytes(event: EventWrapperInternal<CommunityEventInternal>) -> Vec<u8> {
    msgpack::serialize_then_unwrap(event)
}
