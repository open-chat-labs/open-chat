use crate::ChatEventInternal;
use std::collections::BTreeMap;
use std::ops::RangeBounds;
use types::{Chat, EventIndex, EventWrapperInternal, MessageIndex};

pub trait EventsMap {
    fn new(chat: Chat, thread_root_message_index: Option<MessageIndex>) -> Self;
    fn get(&self, event_index: EventIndex) -> Option<EventWrapperInternal<ChatEventInternal>>;
    fn insert(&mut self, event: EventWrapperInternal<ChatEventInternal>);
    fn remove(&mut self, event_index: EventIndex) -> Option<EventWrapperInternal<ChatEventInternal>>;
    fn range<R: RangeBounds<EventIndex>>(
        &self,
        range: R,
    ) -> Box<dyn DoubleEndedIterator<Item = EventWrapperInternal<ChatEventInternal>> + '_>;
    fn iter(&self) -> Box<dyn DoubleEndedIterator<Item = EventWrapperInternal<ChatEventInternal>> + '_>;
}

impl EventsMap for BTreeMap<EventIndex, EventWrapperInternal<ChatEventInternal>> {
    fn new(_chat: Chat, _thread_root_message_index: Option<MessageIndex>) -> Self {
        BTreeMap::new()
    }
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
}
