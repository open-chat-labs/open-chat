use crate::ChatEventInternal;
use std::collections::BTreeMap;
use std::ops::RangeBounds;
use types::{EventIndex, EventWrapperInternal};

pub trait EventsMap {
    fn get_mut(&mut self, event_index: EventIndex) -> Option<&mut EventWrapperInternal<ChatEventInternal>>;
    fn insert(&mut self, event: EventWrapperInternal<ChatEventInternal>);
    fn remove(&mut self, event_index: EventIndex) -> Option<EventWrapperInternal<ChatEventInternal>>;
    fn range<R: RangeBounds<EventIndex>>(
        &self,
        range: R,
    ) -> Box<dyn DoubleEndedIterator<Item = (&EventIndex, &EventWrapperInternal<ChatEventInternal>)> + '_>;
    fn values(&self) -> Box<dyn DoubleEndedIterator<Item = &EventWrapperInternal<ChatEventInternal>> + '_>;
    fn values_mut(&mut self) -> Box<dyn DoubleEndedIterator<Item = &mut EventWrapperInternal<ChatEventInternal>> + '_>;
    fn len(&self) -> usize;
    fn is_empty(&self) -> bool;
}

impl EventsMap for BTreeMap<EventIndex, EventWrapperInternal<ChatEventInternal>> {
    fn get_mut(&mut self, event_index: EventIndex) -> Option<&mut EventWrapperInternal<ChatEventInternal>> {
        self.get_mut(&event_index)
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
    ) -> Box<dyn DoubleEndedIterator<Item = (&EventIndex, &EventWrapperInternal<ChatEventInternal>)> + '_> {
        Box::new(self.range(range))
    }

    fn values(&self) -> Box<dyn DoubleEndedIterator<Item = &EventWrapperInternal<ChatEventInternal>> + '_> {
        Box::new(self.values())
    }

    fn values_mut(&mut self) -> Box<dyn DoubleEndedIterator<Item = &mut EventWrapperInternal<ChatEventInternal>> + '_> {
        Box::new(self.values_mut())
    }

    fn len(&self) -> usize {
        self.len()
    }

    fn is_empty(&self) -> bool {
        self.is_empty()
    }
}
