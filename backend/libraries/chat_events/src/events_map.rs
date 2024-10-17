use crate::ChatEventInternal;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::ops::RangeBounds;
use types::{EventIndex, EventWrapperInternal};

pub trait EventsMap {
    fn get(&self, event_index: EventIndex) -> Option<EventWrapperInternal<ChatEventInternal>>;
    fn insert(&mut self, event: EventWrapperInternal<ChatEventInternal>);
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
    fn get(&self, event_index: EventIndex) -> Option<EventWrapperInternal<ChatEventInternal>> {
        self.0.get(&event_index).cloned()
    }

    fn insert(&mut self, event: EventWrapperInternal<ChatEventInternal>) {
        self.0.insert(event.index, event);
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
