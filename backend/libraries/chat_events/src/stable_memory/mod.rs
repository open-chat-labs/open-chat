use crate::stable_memory::key::{Key, KeyPrefix};
use crate::{ChatEventInternal, EventsMap};
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use stable_memory_map::{with_map, with_map_mut};
use std::cmp::min;
use std::collections::VecDeque;
use std::ops::RangeBounds;
use types::{
    Chat, EventContext, EventIndex, EventWrapperInternal, MessageIndex, TimestampMillis, MAX_EVENT_INDEX, MIN_EVENT_INDEX,
};

pub mod key;

#[cfg(test)]
mod tests;

pub fn garbage_collect(prefix: KeyPrefix) -> Result<u32, u32> {
    let start = Key::new(prefix.clone(), EventIndex::default());
    let mut total_count = 0;
    with_map_mut(|m| {
        // If < 1B instructions have been used so far, delete another 100 keys, or exit if complete
        while ic_cdk::api::instruction_counter() < 1_000_000_000 {
            let keys: Vec<_> = m
                .range(start.to_vec()..)
                .map_while(|(k, _)| Key::try_from(k.as_slice()).ok())
                .take_while(|k| *k.prefix() == prefix)
                .take(100)
                .collect();

            let batch_count = keys.len() as u32;
            total_count += batch_count;
            for key in keys {
                m.remove(&key.to_vec());
            }
            // If batch count < 100 then we are finished
            if batch_count < 100 {
                return Ok(total_count);
            }
        }
        Err(total_count)
    })
}

// Used to efficiently read all events from stable memory when migrating a group into a community
pub fn read_events_as_bytes(chat: Chat, after: Option<EventContext>, max_bytes: usize) -> Vec<(EventContext, ByteBuf)> {
    let key = match after {
        None => Key::new(KeyPrefix::new(chat, None), EventIndex::default()),
        Some(EventContext {
            thread_root_message_index,
            event_index,
        }) => Key::new(KeyPrefix::new(chat, thread_root_message_index), event_index.incr()),
    };
    with_map(|m| {
        let mut total_bytes = 0;
        m.range(key.to_vec()..)
            .map_while(|(k, v)| Key::try_from(k.as_slice()).ok().map(|k| (k, v)))
            .take_while(|(k, v)| {
                if !k.matches_chat(chat) {
                    return false;
                }
                total_bytes += v.len();
                total_bytes < max_bytes
            })
            .map(|(k, v)| (EventContext::new(k.thread_root_message_index(), k.event_index()), v.into()))
            .collect()
    })
}

pub fn write_events_as_bytes(chat: Chat, events: Vec<(EventContext, ByteBuf)>) {
    with_map_mut(|m| {
        for (context, bytes) in events {
            let prefix = KeyPrefix::new(chat, context.thread_root_message_index);
            let key = Key::new(prefix, context.event_index).to_vec();
            let value = bytes.into_vec();
            // Check the event is valid. We could remove this once we're more confident
            let _ = bytes_to_event(&value);
            m.insert(key, value);
        }
    });
}

#[derive(Serialize, Deserialize)]
pub struct ChatEventsStableStorage {
    prefix: KeyPrefix,
}

impl ChatEventsStableStorage {
    pub fn new(chat: Chat, thread_root_message_index: Option<MessageIndex>) -> Self {
        ChatEventsStableStorage {
            prefix: KeyPrefix::new(chat, thread_root_message_index),
        }
    }

    fn key(&self, event_index: EventIndex) -> Key {
        Key::new(self.prefix.clone(), event_index)
    }

    fn iter_as_bytes(&self) -> Iter {
        Iter::new(self.prefix.clone(), MIN_EVENT_INDEX, MAX_EVENT_INDEX)
    }

    fn range_as_bytes<R: RangeBounds<EventIndex>>(&self, range: R) -> Iter {
        let prefix = self.prefix.clone();
        let start = match range.start_bound() {
            std::ops::Bound::Included(i) => *i,
            std::ops::Bound::Excluded(i) if *i == MAX_EVENT_INDEX => return Iter::empty(prefix),
            std::ops::Bound::Excluded(i) => i.incr(),
            std::ops::Bound::Unbounded => MIN_EVENT_INDEX,
        };
        let end = match range.end_bound() {
            std::ops::Bound::Included(i) => *i,
            std::ops::Bound::Excluded(i) if *i == MIN_EVENT_INDEX => return Iter::empty(prefix),
            std::ops::Bound::Excluded(i) => i.decr(),
            std::ops::Bound::Unbounded => MAX_EVENT_INDEX,
        };
        Iter::new(prefix, start, end)
    }

    fn get_internal(&self, event_index: EventIndex) -> Option<Vec<u8>> {
        let key = self.key(event_index);
        with_map(|m| m.get(&key.to_vec()))
    }
}

impl EventsMap for ChatEventsStableStorage {
    fn new(chat: Chat, thread_root_message_index: Option<MessageIndex>) -> Self {
        ChatEventsStableStorage::new(chat, thread_root_message_index)
    }

    fn get(&self, event_index: EventIndex) -> Option<EventWrapperInternal<ChatEventInternal>> {
        self.get_internal(event_index).map(|v| bytes_to_event(&v))
    }

    fn insert(&mut self, event: EventWrapperInternal<ChatEventInternal>) {
        let key = self.key(event.index);
        with_map_mut(|m| m.insert(key.to_vec(), event_to_bytes(event)));
    }

    fn remove(&mut self, event_index: EventIndex) -> Option<EventWrapperInternal<ChatEventInternal>> {
        let key = self.key(event_index);
        with_map_mut(|m| m.remove(&key.to_vec())).map(|v| bytes_to_event(&v))
    }

    fn range<R: RangeBounds<EventIndex>>(
        &self,
        range: R,
    ) -> Box<dyn DoubleEndedIterator<Item = EventWrapperInternal<ChatEventInternal>> + '_> {
        Box::new(EventIter {
            iter: self.range_as_bytes(range),
        })
    }

    fn iter(&self) -> Box<dyn DoubleEndedIterator<Item = EventWrapperInternal<ChatEventInternal>> + '_> {
        Box::new(EventIter {
            iter: self.iter_as_bytes(),
        })
    }
}

fn event_to_bytes(value: EventWrapperInternal<ChatEventInternal>) -> Vec<u8> {
    msgpack::serialize_then_unwrap(&value)
}

fn bytes_to_event(bytes: &[u8]) -> EventWrapperInternal<ChatEventInternal> {
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

const DEFAULT_BUFFER_SIZE: usize = 20;
const MAX_BUFFER_SIZE: usize = 1000;

struct Iter {
    prefix: KeyPrefix,
    next: EventIndex,
    next_back: EventIndex,
    is_forward_buffer: bool,
    next_buffer_size: usize,
    buffer: VecDeque<(EventIndex, Vec<u8>)>,
    finished: bool,
}

impl Iter {
    fn new(prefix: KeyPrefix, start: EventIndex, end: EventIndex) -> Self {
        Iter {
            prefix,
            next: start,
            next_back: end,
            is_forward_buffer: false,
            next_buffer_size: DEFAULT_BUFFER_SIZE,
            buffer: VecDeque::new(),
            finished: false,
        }
    }

    fn empty(prefix: KeyPrefix) -> Iter {
        Iter {
            prefix,
            next: EventIndex::default(),
            next_back: EventIndex::default(),
            is_forward_buffer: true,
            next_buffer_size: 0,
            buffer: VecDeque::new(),
            finished: true,
        }
    }

    fn next_key(&self) -> Key {
        Key::new(self.prefix.clone(), self.next)
    }

    fn next_back_key(&self) -> Key {
        Key::new(self.prefix.clone(), self.next_back)
    }

    fn check_buffer_direction(&mut self, forward: bool) {
        if self.is_forward_buffer == forward {
            self.buffer.clear();
            self.is_forward_buffer = forward;
            self.next_buffer_size = DEFAULT_BUFFER_SIZE;
        }
    }
}

struct EventIter {
    iter: Iter,
}

impl Iterator for EventIter {
    type Item = EventWrapperInternal<ChatEventInternal>;

    fn next(&mut self) -> Option<Self::Item> {
        self.iter.next().map(|(_, v)| bytes_to_event(&v))
    }
}

impl DoubleEndedIterator for EventIter {
    fn next_back(&mut self) -> Option<Self::Item> {
        self.iter.next_back().map(|(_, v)| bytes_to_event(&v))
    }
}

impl Iterator for Iter {
    type Item = (EventIndex, Vec<u8>);

    fn next(&mut self) -> Option<Self::Item> {
        if self.finished {
            return None;
        }
        self.check_buffer_direction(true);
        if self.buffer.is_empty() {
            self.buffer = with_map(|m| {
                m.range(self.next_key().to_vec()..=self.next_back_key().to_vec())
                    .map_while(|(k, v)| Key::try_from(k.as_slice()).ok().map(|k| (k.event_index(), v)))
                    .take(self.next_buffer_size)
                    .collect()
            });
            self.next_buffer_size = min(self.next_buffer_size * 2, MAX_BUFFER_SIZE);
        }
        if let Some((key, value)) = self.buffer.pop_front() {
            self.next = key.incr();
            Some((key, value))
        } else {
            self.finished = true;
            None
        }
    }
}

impl DoubleEndedIterator for Iter {
    fn next_back(&mut self) -> Option<Self::Item> {
        if self.finished {
            return None;
        }
        self.check_buffer_direction(false);
        if self.buffer.is_empty() {
            self.buffer = with_map(|m| {
                m.range(self.next_key().to_vec()..=self.next_back_key().to_vec())
                    .rev()
                    .map_while(|(k, v)| Key::try_from(k.as_slice()).ok().map(|k| (k.event_index(), v)))
                    .take(self.next_buffer_size)
                    .collect()
            });
            self.next_buffer_size = min(self.next_buffer_size * 2, MAX_BUFFER_SIZE);
        }
        if let Some((key, value)) = self.buffer.pop_front() {
            self.next_back = key.decr();
            Some((key, value))
        } else {
            self.finished = true;
            None
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

impl From<EventWrapperFallback> for EventWrapperInternal<ChatEventInternal> {
    fn from(value: EventWrapperFallback) -> Self {
        EventWrapperInternal {
            index: value.index,
            timestamp: value.timestamp,
            correlation_id: 0,
            expires_at: None,
            event: ChatEventInternal::FailedToDeserialize,
        }
    }
}
