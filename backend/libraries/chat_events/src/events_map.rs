use crate::ChatEventInternal;
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
    fn len(&self) -> usize;
    fn is_empty(&self) -> bool;
}

impl EventsMap for BTreeMap<EventIndex, EventWrapperInternal<ChatEventInternal>> {
    fn get(&self, event_index: EventIndex) -> Option<EventWrapperInternal<ChatEventInternal>> {
        self.get(&event_index).cloned()
    }

    fn insert(&mut self, event: EventWrapperInternal<ChatEventInternal>) {
        self.insert(event.index, event);
    }

    fn remove(&mut self, event_index: EventIndex) -> Option<EventWrapperInternal<ChatEventInternal>> {
        self.remove(&event_index)
    }

    fn range<R: RangeBounds<EventIndex>>(
        &self,
        range: R,
    ) -> Box<dyn DoubleEndedIterator<Item = EventWrapperInternal<ChatEventInternal>> + '_> {
        Box::new(self.range(range).map(|(_, e)| e.clone()))
    }

    fn iter(&self) -> Box<dyn DoubleEndedIterator<Item = EventWrapperInternal<ChatEventInternal>> + '_> {
        Box::new(self.values().cloned())
    }

    fn len(&self) -> usize {
        self.len()
    }

    fn is_empty(&self) -> bool {
        self.is_empty()
    }
}
