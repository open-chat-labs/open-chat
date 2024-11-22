use crate::stable_storage::key::{Key, KeyPrefix};
use crate::{ChatEventInternal, EventsMap};
use ic_stable_structures::storable::Bound;
use ic_stable_structures::{StableBTreeMap, Storable};
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use std::borrow::Cow;
use std::cell::RefCell;
use std::cmp::min;
use std::collections::VecDeque;
use std::ops::RangeBounds;
use types::{
    Chat, EventContext, EventIndex, EventWrapperInternal, MessageIndex, TimestampMillis, MAX_EVENT_INDEX, MIN_EVENT_INDEX,
};

pub mod key;

#[cfg(test)]
mod tests;

#[cfg(not(test))]
pub type Memory = ic_stable_structures::memory_manager::VirtualMemory<ic_stable_structures::DefaultMemoryImpl>;

#[cfg(test)]
pub type Memory = ic_stable_structures::VectorMemory;

struct ChatEventsStableStorageInner {
    map: StableBTreeMap<Key, Value, Memory>,
}

struct Value(Vec<u8>);

thread_local! {
    static MAP: RefCell<Option<ChatEventsStableStorageInner>> = RefCell::default();
}

pub fn init(memory: Memory) {
    MAP.set(Some(ChatEventsStableStorageInner::init(memory)));
}

pub fn garbage_collect(prefix: KeyPrefix) -> Result<u32, u32> {
    let start = Key::new(prefix.clone(), EventIndex::default());
    let mut total_count = 0;
    with_map_mut(|m| {
        // If < 1B instructions have been used so far, delete another 100 keys, or exit if complete
        while ic_cdk::api::instruction_counter() < 1_000_000_000 {
            let keys: Vec<_> = m
                .range(&start..)
                .map(|(k, _)| k)
                .take_while(|k| *k.prefix() == prefix)
                .take(100)
                .collect();

            let batch_count = keys.len() as u32;
            total_count += batch_count;
            for key in keys {
                m.remove(&key);
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
        m.range(key..)
            .take_while(|(k, v)| {
                if !k.matches_chat(chat) {
                    return false;
                }
                total_bytes += v.0.len();
                total_bytes < max_bytes
            })
            .map(|(k, v)| (EventContext::new(k.thread_root_message_index(), k.event_index()), v.0.into()))
            .collect()
    })
}

pub fn write_events_as_bytes(chat: Chat, events: Vec<(EventContext, ByteBuf)>) {
    with_map_mut(|m| {
        for (context, bytes) in events {
            let prefix = KeyPrefix::new(chat, context.thread_root_message_index);
            let key = Key::new(prefix, context.event_index);
            let value = Value(bytes.into_vec());
            // Check the event is valid. We could remove this once we're more confident
            let _ = EventWrapperInternal::from(&value);
            m.insert(key, value);
        }
    });
}

impl ChatEventsStableStorageInner {
    fn init(memory: Memory) -> ChatEventsStableStorageInner {
        ChatEventsStableStorageInner {
            map: StableBTreeMap::init(memory),
        }
    }
}

fn with_map<F: FnOnce(&StableBTreeMap<Key, Value, Memory>) -> R, R>(f: F) -> R {
    MAP.with_borrow(|m| f(&m.as_ref().unwrap().map))
}

fn with_map_mut<F: FnOnce(&mut StableBTreeMap<Key, Value, Memory>) -> R, R>(f: F) -> R {
    MAP.with_borrow_mut(|m| f(&mut m.as_mut().unwrap().map))
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

    fn get_internal(&self, event_index: EventIndex) -> Option<Value> {
        let key = self.key(event_index);
        with_map(|m| m.get(&key))
    }
}

impl EventsMap for ChatEventsStableStorage {
    fn new(chat: Chat, thread_root_message_index: Option<MessageIndex>) -> Self {
        ChatEventsStableStorage::new(chat, thread_root_message_index)
    }

    fn get(&self, event_index: EventIndex) -> Option<EventWrapperInternal<ChatEventInternal>> {
        self.get_internal(event_index).map(|v| (&v).into())
    }

    fn insert(&mut self, event: EventWrapperInternal<ChatEventInternal>) {
        let key = self.key(event.index);
        with_map_mut(|m| m.insert(key, event.into()));
    }

    fn remove(&mut self, event_index: EventIndex) -> Option<EventWrapperInternal<ChatEventInternal>> {
        let key = self.key(event_index);
        with_map_mut(|m| m.remove(&key)).map(|v| (&v).into())
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

impl Storable for Value {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Borrowed(&self.0)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Value(bytes.to_vec())
    }

    const BOUND: Bound = Bound::Unbounded;
}

impl From<&Value> for EventWrapperInternal<ChatEventInternal> {
    fn from(value: &Value) -> Self {
        match msgpack::deserialize(value.0.as_slice()) {
            Ok(result) => result,
            Err(error) => {
                ic_cdk::eprintln!("Failed to deserialize event from stable memory: {error:?}");
                match msgpack::deserialize::<EventWrapperFallback, _>(value.0.as_slice()) {
                    Ok(fallback) => fallback.into(),
                    Err(fallback_error) => {
                        panic!("Failed to deserialize event from stable memory. Error: {error:?}. Fallback error: {fallback_error:?}");
                    }
                }
            }
        }
    }
}

impl From<EventWrapperInternal<ChatEventInternal>> for Value {
    fn from(value: EventWrapperInternal<ChatEventInternal>) -> Self {
        let bytes = msgpack::serialize_then_unwrap(&value);
        Value(bytes)
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
    buffer: VecDeque<(EventIndex, Value)>,
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

    fn range_bounds(&self) -> impl RangeBounds<Key> {
        self.next_key()..=self.next_back_key()
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
        self.iter.next().map(|(_, v)| (&v).into())
    }
}

impl DoubleEndedIterator for EventIter {
    fn next_back(&mut self) -> Option<Self::Item> {
        self.iter.next_back().map(|(_, v)| (&v).into())
    }
}

impl Iterator for Iter {
    type Item = (EventIndex, Value);

    fn next(&mut self) -> Option<Self::Item> {
        if self.finished {
            return None;
        }
        self.check_buffer_direction(true);
        if self.buffer.is_empty() {
            self.buffer = with_map(|m| {
                m.range(self.range_bounds())
                    .take(self.next_buffer_size)
                    .map(|(k, v)| (k.event_index(), v))
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
                m.range(self.range_bounds())
                    .rev()
                    .take(self.next_buffer_size)
                    .map(|(k, v)| (k.event_index(), v))
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
