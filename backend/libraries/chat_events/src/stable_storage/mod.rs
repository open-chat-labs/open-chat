use crate::stable_storage::key::{
    ChannelKeyPrefix, ChannelThreadKeyPrefix, DirectChatKeyPrefix, DirectChatThreadKeyPrefix, GroupChatKeyPrefix,
    GroupChatThreadKeyPrefix, Key, KeyPrefix,
};
use crate::{ChatEventInternal, EventsMap};
use candid::Principal;
use ic_stable_structures::memory_manager::VirtualMemory;
use ic_stable_structures::storable::Bound;
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap, Storable};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::cell::RefCell;
use std::cmp::min;
use std::collections::VecDeque;
use std::ops::RangeBounds;
use types::{Chat, EventIndex, EventWrapperInternal, MessageIndex, MAX_EVENT_INDEX, MIN_EVENT_INDEX};

mod key;

pub type Memory = VirtualMemory<DefaultMemoryImpl>;

struct ChatEventsStableStorageInner {
    map: StableBTreeMap<Key, Value, Memory>,
}

struct Value(EventWrapperInternal<ChatEventInternal>);

thread_local! {
    static MAP: RefCell<Option<ChatEventsStableStorageInner>> = RefCell::default();
}

pub fn init(memory: Memory) {
    MAP.set(Some(ChatEventsStableStorageInner::init(memory)));
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
    fn key(&self, event_index: EventIndex) -> Key {
        Key::new(self.prefix.clone(), event_index)
    }
}

impl EventsMap for ChatEventsStableStorage {
    fn new(chat: Chat, thread_root_message_index: Option<MessageIndex>) -> Self {
        let prefix = match (chat, thread_root_message_index) {
            (Chat::Direct(c), None) => KeyPrefix::DirectChat(DirectChatKeyPrefix::new(Principal::from(c).into())),
            (Chat::Direct(c), Some(m)) => {
                KeyPrefix::DirectChatThread(DirectChatThreadKeyPrefix::new(Principal::from(c).into(), m))
            }
            (Chat::Group(_), None) => KeyPrefix::GroupChat(GroupChatKeyPrefix::default()),
            (Chat::Group(_), Some(m)) => KeyPrefix::GroupChatThread(GroupChatThreadKeyPrefix::new(m)),
            (Chat::Channel(_, c), None) => KeyPrefix::Channel(ChannelKeyPrefix::new(c.into())),
            (Chat::Channel(_, c), Some(m)) => KeyPrefix::ChannelThread(ChannelThreadKeyPrefix::new(c.into(), m)),
        };
        ChatEventsStableStorage { prefix }
    }

    fn get(&self, event_index: EventIndex) -> Option<EventWrapperInternal<ChatEventInternal>> {
        let key = self.key(event_index);
        with_map(|m| m.get(&key)).map(|v| v.into())
    }

    fn insert(&mut self, event: EventWrapperInternal<ChatEventInternal>) {
        let key = self.key(event.index);
        with_map_mut(|m| m.insert(key, event.into()));
    }

    fn remove(&mut self, event_index: EventIndex) -> Option<EventWrapperInternal<ChatEventInternal>> {
        let key = self.key(event_index);
        with_map_mut(|m| m.remove(&key)).map(|v| v.into())
    }

    fn range<R: RangeBounds<EventIndex>>(
        &self,
        range: R,
    ) -> Box<dyn DoubleEndedIterator<Item = EventWrapperInternal<ChatEventInternal>> + '_> {
        let start = match range.start_bound() {
            std::ops::Bound::Included(i) => *i,
            std::ops::Bound::Excluded(i) if *i == MAX_EVENT_INDEX => return Box::new(std::iter::empty()),
            std::ops::Bound::Excluded(i) => i.incr(),
            std::ops::Bound::Unbounded => MIN_EVENT_INDEX,
        };
        let end = match range.end_bound() {
            std::ops::Bound::Included(i) => *i,
            std::ops::Bound::Excluded(i) if *i == MIN_EVENT_INDEX => return Box::new(std::iter::empty()),
            std::ops::Bound::Excluded(i) => i.decr(),
            std::ops::Bound::Unbounded => MAX_EVENT_INDEX,
        };
        Box::new(Iter::new(self.prefix.clone(), start, end))
    }

    fn iter(&self) -> Box<dyn DoubleEndedIterator<Item = EventWrapperInternal<ChatEventInternal>> + '_> {
        Box::new(Iter::new(self.prefix.clone(), MIN_EVENT_INDEX, MAX_EVENT_INDEX))
    }
}

impl Storable for Value {
    fn to_bytes(&self) -> Cow<[u8]> {
        msgpack::serialize_then_unwrap(&self.0).into()
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Value(msgpack::deserialize_then_unwrap(bytes.as_ref()))
    }

    const BOUND: Bound = Bound::Unbounded;
}

impl From<Value> for EventWrapperInternal<ChatEventInternal> {
    fn from(value: Value) -> Self {
        value.0
    }
}

impl From<EventWrapperInternal<ChatEventInternal>> for Value {
    fn from(value: EventWrapperInternal<ChatEventInternal>) -> Self {
        Value(value)
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
    buffer: VecDeque<EventWrapperInternal<ChatEventInternal>>,
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

impl Iterator for Iter {
    type Item = EventWrapperInternal<ChatEventInternal>;

    fn next(&mut self) -> Option<Self::Item> {
        if self.finished {
            return None;
        }
        self.check_buffer_direction(true);
        if self.buffer.is_empty() {
            self.buffer = with_map(|m| {
                m.range(self.range_bounds())
                    .take(self.next_buffer_size)
                    .map(|(_, v)| v.into())
                    .collect()
            });
            self.next_buffer_size = min(self.next_buffer_size * 2, MAX_BUFFER_SIZE);
        }
        if let Some(next) = self.buffer.pop_front() {
            self.next = next.index.incr();
            Some(next)
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
                    .map(|(_, v)| v.into())
                    .collect()
            });
            self.next_buffer_size = min(self.next_buffer_size * 2, MAX_BUFFER_SIZE);
        }
        if let Some(next) = self.buffer.pop_front() {
            self.next_back = next.index.decr();
            Some(next)
        } else {
            self.finished = true;
            None
        }
    }
}
