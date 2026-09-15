use crate::ChatEventInternal;
use serde::{Deserialize, Serialize};
use stable_memory_map::ChatEventKeyPrefix;
use std::collections::BTreeMap;
use std::ops::RangeBounds;
use types::{EventIndex, EventWrapperInternal};

pub trait EventsMap {
    fn new(stable_memory_prefix: ChatEventKeyPrefix) -> Self;
    fn get(&self, event_index: EventIndex) -> Option<EventWrapperInternal<ChatEventInternal>>;
    fn insert(&mut self, event: EventWrapperInternal<ChatEventInternal>);
    // Applies `update_fn` to the event at `event_index`, writing the event back if `update_fn`
    // returns `Ok`, in which case the updated event is returned along with the value. Returns
    // `None` if there is no event at `event_index`. Implementations backed by stable memory look
    // the event up only once, so `update_fn` must not access the stable memory map.
    fn update<T, E, F: FnOnce(&mut EventWrapperInternal<ChatEventInternal>) -> Result<T, E>>(
        &mut self,
        event_index: EventIndex,
        update_fn: F,
    ) -> Option<Result<(EventWrapperInternal<ChatEventInternal>, T), E>>;
    fn remove(&mut self, event_index: EventIndex) -> Option<EventWrapperInternal<ChatEventInternal>>;
    fn range<R: RangeBounds<EventIndex>>(
        &self,
        range: R,
    ) -> Box<dyn DoubleEndedIterator<Item = EventWrapperInternal<ChatEventInternal>> + '_>;
    fn iter(&self) -> Box<dyn DoubleEndedIterator<Item = EventWrapperInternal<ChatEventInternal>> + '_>;
}

#[derive(Serialize, Deserialize, Default)]
pub struct ChatEventsMap(BTreeMap<EventIndex, EventWrapperInternal<ChatEventInternal>>);

impl EventsMap for ChatEventsMap {
    fn new(_stable_memory_prefix: ChatEventKeyPrefix) -> Self {
        ChatEventsMap(BTreeMap::new())
    }

    fn get(&self, event_index: EventIndex) -> Option<EventWrapperInternal<ChatEventInternal>> {
        self.0.get(&event_index).cloned()
    }

    fn insert(&mut self, event: EventWrapperInternal<ChatEventInternal>) {
        self.0.insert(event.index, event);
    }

    fn update<T, E, F: FnOnce(&mut EventWrapperInternal<ChatEventInternal>) -> Result<T, E>>(
        &mut self,
        event_index: EventIndex,
        update_fn: F,
    ) -> Option<Result<(EventWrapperInternal<ChatEventInternal>, T), E>> {
        // The event is only modified if `update_fn` succeeds
        let mut event = self.0.get(&event_index)?.clone();
        Some(update_fn(&mut event).map(|value| {
            self.0.insert(event_index, event.clone());
            (event, value)
        }))
    }

    fn remove(&mut self, event_index: EventIndex) -> Option<EventWrapperInternal<ChatEventInternal>> {
        self.0.remove(&event_index)
    }

    fn range<R: RangeBounds<EventIndex>>(
        &self,
        range: R,
    ) -> Box<dyn DoubleEndedIterator<Item = EventWrapperInternal<ChatEventInternal>> + '_> {
        Box::new(self.0.range(range).map(|(_, e)| e.clone()))
    }

    fn iter(&self) -> Box<dyn DoubleEndedIterator<Item = EventWrapperInternal<ChatEventInternal>> + '_> {
        Box::new(self.0.values().cloned())
    }
}
