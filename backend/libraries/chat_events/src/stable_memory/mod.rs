use crate::message_ids::MessageIdsStableStorage;
use crate::search_index::{SearchIndex, insert_entries};
use crate::{ChatEventInternal, EventsMap};
use search::simple::Document;
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use stable_memory_map::{
    ChatEventKey, ChatEventKeyPrefix, ExpiringEventKeyPrefix, Key, KeyPrefix, MessageIdKeyPrefix, StableMemoryMap, with_map,
    with_map_mut,
};
use std::cmp::{max, min};
use std::collections::VecDeque;
use std::ops::RangeBounds;
use types::{
    Chat, EventContext, EventIndex, EventWrapperInternal, MAX_EVENT_INDEX, MIN_EVENT_INDEX, MessageIndex, TimestampMillis,
};

#[cfg(test)]
mod tests;

// Used to efficiently read all events from stable memory when migrating a group into a community
pub fn read_events_as_bytes(
    main_events_prefix: &ChatEventKeyPrefix,
    after: Option<EventContext>,
    max_bytes: usize,
) -> Vec<(EventContext, ByteBuf)> {
    let key = match after {
        None => main_events_prefix.create_key(&EventIndex::default()),
        Some(EventContext {
            thread_root_message_index: None,
            event_index,
        }) => main_events_prefix.create_key(&event_index.incr()),
        Some(EventContext {
            thread_root_message_index: Some(root_message_index),
            event_index,
        }) => main_events_prefix
            .for_thread(root_message_index)
            .create_key(&event_index.incr()),
    };
    with_map(|m| {
        let mut total_bytes = 0;
        m.range(key..)
            .take_while(|(k, v)| {
                if !k.is_in_chat(main_events_prefix) {
                    return false;
                }
                if k.thread_root_message_index().is_some() {
                    total_bytes += size_of::<MessageIndex>();
                }
                total_bytes += size_of::<EventIndex>();
                total_bytes += v.len();
                total_bytes < max_bytes
            })
            .map(|(k, v)| (EventContext::new(k.thread_root_message_index(), k.event_index()), v.into()))
            .collect()
    })
}

// Used to efficiently write all events to stable memory when migrating a group into a community
pub fn write_events_as_bytes(chat: Chat, events: Vec<(EventContext, ByteBuf)>) {
    let mut event_entries = Vec::with_capacity(events.len());
    let mut message_id_entries = Vec::new();
    let mut expiring_event_entries = Vec::new();
    let mut search_index_entries = Vec::new();

    for (context, bytes) in events {
        let prefix = ChatEventKeyPrefix::new_from_chat(chat, context.thread_root_message_index);
        let value = bytes.into_vec();
        // Deserializing also checks the event is valid
        let event = bytes_to_event(&value);
        if let ChatEventInternal::Message(message) = &event.event {
            let message_id_key = MessageIdKeyPrefix::from(&prefix).create_key(&message.message_id);
            message_id_entries.push((message_id_key, MessageIdsStableStorage::value_to_bytes(context.event_index)));

            // Only the main events list is indexed, and deleted messages are removed from the index
            if context.thread_root_message_index.is_none() && message.deleted_by.is_none() {
                search_index_entries.extend(SearchIndex::entries(
                    &prefix,
                    message.message_index,
                    message.sender,
                    &Document::from(&message.content),
                ));
            }
        }
        if let Some(expires_at) = event.expires_at
            && let Ok(expiring_events_prefix) = ExpiringEventKeyPrefix::try_from(&prefix)
        {
            let expiring_event_key = expiring_events_prefix.create_key(&(expires_at, context.event_index));
            expiring_event_entries.push((expiring_event_key, Vec::new()));
        }
        event_entries.push((prefix.create_key(&context.event_index), value));
    }

    // The events are exported in key order, but the other entries need sorting into key order so
    // that each batch of inserts writes as few nodes as possible
    message_id_entries.sort_unstable_by(|(k1, _), (k2, _)| k1.cmp(k2));
    expiring_event_entries.sort_unstable_by(|(k1, _), (k2, _)| k1.cmp(k2));

    with_map_mut(|m| {
        m.insert_many(event_entries);
        m.insert_many(message_id_entries);
        m.insert_many(expiring_event_entries);
    });
    insert_entries(search_index_entries);
}

#[derive(Serialize, Deserialize)]
pub struct ChatEventsStableStorage {
    prefix: ChatEventKeyPrefix,
    // Set while the events of a direct chat created before `key_id`s were introduced are being
    // moved from their legacy keys (based on the other user's id) to keys based on the `key_id`.
    // This can be removed once every user canister has migrated.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    legacy: Option<LegacyEvents>,
}

#[derive(Serialize, Deserialize)]
struct LegacyEvents {
    prefix: ChatEventKeyPrefix,
    // Events with an index below this have been moved to their new keys, the rest are still under
    // the legacy keys. Events are moved in index order so that reads stay consistent throughout.
    migrated_below: EventIndex,
}

// How many events are moved before checking whether the migration should pause
const LEGACY_EVENTS_MIGRATION_BATCH_SIZE: usize = 100;

impl StableMemoryMap<ChatEventKeyPrefix, EventWrapperInternal<ChatEventInternal>> for ChatEventsStableStorage {
    fn prefix(&self) -> &ChatEventKeyPrefix {
        &self.prefix
    }

    fn value_to_bytes(value: EventWrapperInternal<ChatEventInternal>) -> Vec<u8> {
        event_to_bytes(value)
    }

    fn bytes_to_value(_key: &EventIndex, bytes: Vec<u8>) -> EventWrapperInternal<ChatEventInternal> {
        bytes_to_event(&bytes)
    }
}

impl ChatEventsStableStorage {
    pub fn new(prefix: ChatEventKeyPrefix) -> Self {
        ChatEventsStableStorage { prefix, legacy: None }
    }

    // The prefix of the legacy keys whose events have not yet been moved to the new keys, if any
    pub fn legacy_prefix(&self) -> Option<&ChatEventKeyPrefix> {
        self.legacy.as_ref().map(|l| &l.prefix)
    }

    pub fn has_legacy_events(&self) -> bool {
        self.legacy.is_some()
    }

    // Switches a direct chat whose events are stored under legacy keys over to the given `key_id`
    // based prefix. The events stay readable under their legacy keys until `migrate_legacy_events`
    // has moved them across.
    pub fn assign_key_id_prefix(&mut self, prefix: ChatEventKeyPrefix) {
        assert!(self.legacy.is_none(), "events are already being migrated from legacy keys");
        let legacy_prefix = std::mem::replace(&mut self.prefix, prefix);
        assert!(
            legacy_prefix.is_legacy_direct_chat(),
            "only legacy direct chat keys can be migrated"
        );
        self.legacy = Some(LegacyEvents {
            prefix: legacy_prefix,
            migrated_below: MIN_EVENT_INDEX,
        });
    }

    // Moves events from their legacy keys to their new keys in batches, calling `should_stop`
    // after each batch. Returns true once every event has been moved.
    pub fn migrate_legacy_events(&mut self, should_stop: &mut impl FnMut() -> bool) -> bool {
        loop {
            let Some(legacy) = &self.legacy else {
                return true;
            };
            let batch: Vec<_> = with_map(|m| {
                m.range(legacy.prefix.create_key(&legacy.migrated_below)..)
                    .take_while(|(k, _)| k.matches_prefix(&legacy.prefix))
                    .take(LEGACY_EVENTS_MIGRATION_BATCH_SIZE)
                    .map(|(k, v)| (k.event_index(), v))
                    .collect()
            });
            let Some((last_index, _)) = batch.last() else {
                self.legacy = None;
                return true;
            };
            let migrated_below = last_index.incr();
            let batch_size = batch.len();
            with_map_mut(|m| {
                for (index, _) in batch.iter() {
                    m.remove(legacy.prefix.create_key(index));
                }
                m.insert_many(
                    batch
                        .into_iter()
                        .map(|(index, bytes)| (self.prefix.create_key(&index), bytes)),
                );
            });
            if batch_size < LEGACY_EVENTS_MIGRATION_BATCH_SIZE {
                self.legacy = None;
                return true;
            }
            self.legacy.as_mut().unwrap().migrated_below = migrated_below;
            if should_stop() {
                return false;
            }
        }
    }

    // The prefix under which the event with the given index is stored
    fn prefix_for(&self, event_index: EventIndex) -> &ChatEventKeyPrefix {
        match &self.legacy {
            Some(legacy) if event_index >= legacy.migrated_below => &legacy.prefix,
            _ => &self.prefix,
        }
    }

    fn iter_as_bytes(&self) -> RangeIter {
        self.range_as_bytes(..)
    }

    fn range_as_bytes<R: RangeBounds<EventIndex>>(&self, range: R) -> RangeIter {
        let start = match range.start_bound() {
            std::ops::Bound::Included(i) => *i,
            std::ops::Bound::Excluded(i) if *i == MAX_EVENT_INDEX => return empty_range_iter(),
            std::ops::Bound::Excluded(i) => i.incr(),
            std::ops::Bound::Unbounded => MIN_EVENT_INDEX,
        };
        let end = match range.end_bound() {
            std::ops::Bound::Included(i) => *i,
            std::ops::Bound::Excluded(i) if *i == MIN_EVENT_INDEX => return empty_range_iter(),
            std::ops::Bound::Excluded(i) => i.decr(),
            std::ops::Bound::Unbounded => MAX_EVENT_INDEX,
        };
        match &self.legacy {
            // Events below the boundary are under the new keys, the rest are still under the legacy keys
            Some(legacy) if legacy.migrated_below > MIN_EVENT_INDEX => {
                let boundary = legacy.migrated_below;
                Iter::new(self.prefix.clone(), start, min(end, boundary.decr())).chain(Iter::new(
                    legacy.prefix.clone(),
                    max(start, boundary),
                    end,
                ))
            }
            Some(legacy) => Iter::new(legacy.prefix.clone(), start, end).chain(Iter::empty()),
            None => Iter::new(self.prefix.clone(), start, end).chain(Iter::empty()),
        }
    }
}

type RangeIter = std::iter::Chain<Iter, Iter>;

fn empty_range_iter() -> RangeIter {
    Iter::empty().chain(Iter::empty())
}

impl EventsMap for ChatEventsStableStorage {
    fn new(stable_memory_prefix: ChatEventKeyPrefix) -> Self {
        ChatEventsStableStorage::new(stable_memory_prefix)
    }

    fn get(&self, event_index: EventIndex) -> Option<EventWrapperInternal<ChatEventInternal>> {
        with_map(|m| m.get(self.prefix_for(event_index).create_key(&event_index))).map(|v| bytes_to_event(&v))
    }

    fn insert(&mut self, event: EventWrapperInternal<ChatEventInternal>) {
        let key = self.prefix_for(event.index).create_key(&event.index);
        with_map_mut(|m| m.insert(key, event_to_bytes(event)));
    }

    fn remove(&mut self, event_index: EventIndex) -> Option<EventWrapperInternal<ChatEventInternal>> {
        with_map_mut(|m| m.remove(self.prefix_for(event_index).create_key(&event_index))).map(|v| bytes_to_event(&v))
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
    prefix: ChatEventKeyPrefix,
    next: EventIndex,
    next_back: EventIndex,
    is_forward_buffer: bool,
    next_buffer_size: usize,
    buffer: VecDeque<(EventIndex, Vec<u8>)>,
    finished: bool,
}

impl Iter {
    fn new(prefix: ChatEventKeyPrefix, start: EventIndex, end: EventIndex) -> Self {
        if start > end {
            return Iter::empty();
        }
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

    fn empty() -> Iter {
        Iter {
            // Never read since the iterator is already finished
            prefix: ChatEventKeyPrefix::new_from_group_chat(None),
            next: EventIndex::default(),
            next_back: EventIndex::default(),
            is_forward_buffer: true,
            next_buffer_size: 0,
            buffer: VecDeque::new(),
            finished: true,
        }
    }

    fn next_key(&self) -> ChatEventKey {
        self.prefix.create_key(&self.next)
    }

    fn next_back_key(&self) -> ChatEventKey {
        self.prefix.create_key(&self.next_back)
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
    iter: RangeIter,
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
                m.range(self.next_key()..=self.next_back_key())
                    .map(|(k, v)| (k.event_index(), v))
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
                m.range(self.next_key()..=self.next_back_key())
                    .rev()
                    .map(|(k, v)| (k.event_index(), v))
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
            expires_at: None,
            event: ChatEventInternal::FailedToDeserialize,
        }
    }
}
