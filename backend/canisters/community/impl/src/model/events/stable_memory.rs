use crate::model::events::CommunityEventInternal;
use candid::Deserialize;
use serde::Serialize;
use stable_memory_map::{CommunityEventKeyPrefix, KeyPrefix, with_map, with_map_mut};
use types::{EventIndex, EventWrapperInternal, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct EventsStableStorage {
    prefix: CommunityEventKeyPrefix,
}

impl EventsStableStorage {
    pub fn get(&self, event_index: EventIndex) -> Option<EventWrapperInternal<CommunityEventInternal>> {
        with_map(|m| {
            m.get(self.prefix.create_key(&event_index))
                .map(|bytes| bytes_to_event(&bytes))
        })
    }

    pub fn insert(&mut self, event: EventWrapperInternal<CommunityEventInternal>) {
        with_map_mut(|m| m.insert(self.prefix.create_key(&event.index), event_to_bytes(event)));
    }

    pub fn range(
        &self,
        start: EventIndex,
        end: EventIndex,
    ) -> Box<dyn DoubleEndedIterator<Item = EventWrapperInternal<CommunityEventInternal>> + '_> {
        with_map(|m| {
            Box::new(
                m.range(self.prefix.create_key(&start)..=self.prefix.create_key(&end))
                    .map(|(_, bytes)| bytes_to_event(&bytes))
                    .collect::<Vec<_>>()
                    .into_iter(),
            )
        })
    }
}

fn event_to_bytes(event: EventWrapperInternal<CommunityEventInternal>) -> Vec<u8> {
    msgpack::serialize_then_unwrap(event)
}

fn bytes_to_event(bytes: &[u8]) -> EventWrapperInternal<CommunityEventInternal> {
    match msgpack::deserialize(bytes) {
        Ok(result) => result,
        Err(error) => {
            ic_cdk::eprintln!("Failed to deserialize event from stable memory: {error:?}");
            match msgpack::deserialize::<EventWrapperFallback, _>(bytes) {
                Ok(fallback) => fallback.into(),
                Err(fallback_error) => {
                    panic!(
                        "Failed to deserialize event from stable memory. Error: {error:?}. Fallback error: {fallback_error:?}"
                    );
                }
            }
        }
    }
}

// Deserialize to this as a fallback if deserializing the event fails
#[derive(Deserialize)]
struct EventWrapperFallback {
    #[serde(rename = "i")]
    pub index: EventIndex,
    #[serde(rename = "t")]
    pub timestamp: TimestampMillis,
}

impl From<EventWrapperFallback> for EventWrapperInternal<CommunityEventInternal> {
    fn from(value: EventWrapperFallback) -> Self {
        EventWrapperInternal {
            index: value.index,
            timestamp: value.timestamp,
            expires_at: None,
            event: CommunityEventInternal::FailedToDeserialize,
        }
    }
}
