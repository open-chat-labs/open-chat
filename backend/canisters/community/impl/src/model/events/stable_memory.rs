use crate::model::events::CommunityEventInternal;
use candid::Deserialize;
use serde::Serialize;
use stable_memory_map::{CommunityEventKeyPrefix, StableMemoryMap};
use types::EventWrapperInternal;

#[derive(Serialize, Deserialize, Default)]
pub struct EventsStableStorage {
    #[serde(default)]
    map: StableMemoryMap<CommunityEventKeyPrefix, EventWrapperInternal<CommunityEventInternal>>,
}

impl EventsStableStorage {
    pub fn insert(&mut self, event: EventWrapperInternal<CommunityEventInternal>) {
        self.map.insert(&event.index, &event);
    }
}
