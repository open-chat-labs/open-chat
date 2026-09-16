use crate::hybrid_map::HybridMap;
use crate::last_updated_timestamps::LastUpdatedTimestamps;
use crate::message_event_indexes::MessageEventIndexes;
use crate::message_ids::MessageIdsStableStorage;
use crate::stable_memory::ChatEventsStableStorage;
use crate::{
    ChatEventInternal, EventKey, EventOrExpiredRangeInternal, EventsMap, MessageInternal, UpdateEventError,
    UpdateEventInternalSuccess,
};
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use stable_memory_map::{ChatEventKeyPrefix, KeyPrefix, StableMemoryMap, with_map_mut};
use std::cmp::max;
use std::collections::{HashMap, HashSet};
use std::iter::Peekable;
use std::ops::Deref;
use types::{
    ChatEvent, ChatEventCategory, EventIndex, EventOrExpiredRange, EventWrapper, EventWrapperInternal, HydratedMention,
    Mention, Message, MessageId, MessageIndex, TimestampMillis, UserId,
};

#[derive(Serialize, Deserialize)]
pub struct ChatEventsList {
    events_map: HybridMap<ChatEventsStableStorage>,
    // Message ids which haven't yet been moved into stable memory. New message ids are always
    // written to stable memory, and existing ones are moved across in batches by
    // `migrate_message_ids_to_stable_memory`. This can be removed once every chat has been migrated.
    // It is always serialized so that a canister can still be rolled back to a version expecting it.
    #[serde(rename = "message_id_map", default)]
    message_ids_on_heap: HashMap<MessageId, EventIndex>,
    message_event_indexes: MessageEventIndexes,
    latest_event_index: Option<EventIndex>,
    latest_event_timestamp: Option<TimestampMillis>,
}

impl ChatEventsList {
    pub fn set_stable_memory_prefix(&mut self, prefix: ChatEventKeyPrefix) {
        self.events_map.set_stable_memory_prefix(prefix);
    }

    pub fn stable_memory_prefix(&self) -> &ChatEventKeyPrefix {
        self.events_map.stable_memory_prefix()
    }

    // The prefix of the legacy keys under which some of the events are still stored, if any
    pub fn legacy_stable_memory_prefix(&self) -> Option<&ChatEventKeyPrefix> {
        self.events_map.legacy_stable_memory_prefix()
    }

    pub fn has_legacy_events(&self) -> bool {
        self.events_map.has_legacy_events()
    }

    // Switches a direct chat whose events are stored under legacy keys over to the given `key_id`
    // based prefix, from which every other prefix is derived from then on. The events themselves are
    // moved across by `migrate_legacy_events_batch`.
    pub fn assign_key_id_prefix(&mut self, prefix: ChatEventKeyPrefix) {
        self.events_map.assign_key_id_prefix(prefix);
    }

    // Moves the next batch of events from the legacy keys, returning true once every event has been moved
    pub fn migrate_legacy_events_batch(&mut self) -> bool {
        self.events_map.migrate_legacy_events_batch()
    }

    pub fn new(stable_memory_prefix: ChatEventKeyPrefix) -> Self {
        ChatEventsList {
            events_map: HybridMap::new(stable_memory_prefix),
            message_ids_on_heap: HashMap::new(),
            message_event_indexes: MessageEventIndexes::default(),
            latest_event_index: None,
            latest_event_timestamp: None,
        }
    }

    pub(crate) fn push_event(
        &mut self,
        event: ChatEventInternal,
        expires_at: Option<TimestampMillis>,
        now: TimestampMillis,
    ) -> EventIndex {
        let event_index = self.next_event_index();
        if let ChatEventInternal::Message(m) = &event {
            if self.message_ids_on_heap.contains_key(&m.message_id)
                || self.message_ids().insert(m.message_id, event_index).is_some()
            {
                panic!("MessageId already used: {:?}", m.message_id);
            }
            self.message_event_indexes
                .push(self.events_map.stable_memory_prefix(), m.message_index, event_index);
        }

        let event_wrapper = EventWrapperInternal {
            index: event_index,
            timestamp: now,
            expires_at,
            event,
        };
        self.events_map.insert(event_wrapper);

        self.latest_event_index = Some(event_index);
        self.latest_event_timestamp = Some(now);

        event_index
    }

    pub(crate) fn get(
        &self,
        event_key: EventKey,
        min_visible_event_index: EventIndex,
        bot_permitted_event_types: Option<&HashSet<ChatEventCategory>>,
    ) -> Option<EventOrExpiredRangeInternal> {
        let event_index = self.event_index(event_key).filter(|e| *e >= min_visible_event_index)?;

        match self.get_value_or_neighbours(event_index) {
            Ok(event) => {
                if bot_permitted_event_types.is_none_or(|pt| event.event.event_category().is_some_and(|t| pt.contains(&t))) {
                    Some(EventOrExpiredRangeInternal::Event(event))
                } else {
                    Some(EventOrExpiredRangeInternal::Unauthorized(event.index))
                }
            }
            Err((prev, next)) => Some(EventOrExpiredRangeInternal::ExpiredEventRange(
                prev.map_or(EventIndex::default(), |i| i.incr()),
                next.map_or(self.latest_event_index.unwrap_or_default(), |i| i.decr()),
            )),
        }
    }

    pub(crate) fn get_event(
        &self,
        event_key: EventKey,
        min_visible_event_index: EventIndex,
        bot_permitted_event_types: Option<&HashSet<ChatEventCategory>>,
    ) -> Option<EventWrapperInternal<ChatEventInternal>> {
        self.get(event_key, min_visible_event_index, bot_permitted_event_types)
            .and_then(|e| e.into_event())
    }

    pub(crate) fn update_event<
        F: FnOnce(&mut EventWrapperInternal<ChatEventInternal>) -> Result<T, UpdateEventError<E>>,
        T,
        E,
    >(
        &mut self,
        event_key: EventKey,
        update_event_fn: F,
    ) -> Result<UpdateEventInternalSuccess<T>, UpdateEventError<E>> {
        if let Some(mut event) = self.get_event(event_key, EventIndex::default(), None) {
            update_event_fn(&mut event).map(|result| {
                self.events_map.insert(event.clone());
                UpdateEventInternalSuccess {
                    event_index: event.index,
                    event: event.event,
                    value: result,
                }
            })
        } else {
            Err(UpdateEventError::NotFound)
        }
    }

    pub(crate) fn is_accessible(&self, event_key: EventKey, min_visible_event_index: EventIndex) -> bool {
        self.event_index(event_key).is_some_and(|e| e >= min_visible_event_index)
    }

    pub(crate) fn iter(
        &self,
        start: Option<EventKey>,
        ascending: bool,
        min_visible_event_index: EventIndex,
        bot_permitted_event_types: Option<HashSet<ChatEventCategory>>,
    ) -> Box<dyn Iterator<Item = EventOrExpiredRangeInternal> + '_> {
        let (min, max) = if let Some(start) = start {
            if let Some(index) = self.event_index(start) {
                if ascending {
                    // A start below the caller's min visible index (stale client summary, explicit
                    // link into hidden history) must not expose events they cannot see
                    (
                        max(index, min_visible_event_index),
                        self.latest_event_index.unwrap_or_default(),
                    )
                } else {
                    (min_visible_event_index, index)
                }
            } else {
                return Box::new(std::iter::empty());
            }
        } else {
            (min_visible_event_index, self.latest_event_index.unwrap_or_default())
        };

        if min > max {
            return Box::new(std::iter::empty());
        }

        let iter = self.events_map.range(min..=max);

        if ascending {
            Box::new(ChatEventsListIterator {
                inner: iter.peekable(),
                ascending: true,
                expected_next: min,
                end: max,
                complete: false,
                bot_permitted_event_types,
            })
        } else {
            Box::new(ChatEventsListIterator {
                inner: iter.rev().peekable(),
                ascending: false,
                expected_next: max,
                end: min,
                complete: false,
                bot_permitted_event_types,
            })
        }
    }

    // The event ranges must be sorted before calling this method
    pub fn convert_to_message_ranges(&self, event_ranges: &[(EventIndex, EventIndex)]) -> Vec<(MessageIndex, MessageIndex)> {
        let mut ranges: Vec<(MessageIndex, MessageIndex)> = Vec::new();
        for range in event_ranges
            .iter()
            .filter_map(|(from, to)| self.convert_to_message_range(*from, *to))
        {
            // If this range is contiguous with the previous one, expand the previous one
            if let Some(previous) = ranges.last_mut().filter(|(_, to)| to.incr() >= range.0) {
                previous.1 = range.1
            } else {
                ranges.push(range);
            }
        }
        ranges
    }

    fn convert_to_message_range(&self, from: EventIndex, to: EventIndex) -> Option<(MessageIndex, MessageIndex)> {
        let events_prefix = self.events_map.stable_memory_prefix();
        let from_message_index = self.message_event_indexes.partition_point(events_prefix, |e| e < from);
        let to_message_index = self
            .message_event_indexes
            .partition_point(events_prefix, |e| e <= to)
            .checked_sub(1)?;

        if from_message_index <= to_message_index {
            Some((
                MessageIndex::from(from_message_index as u32),
                MessageIndex::from(to_message_index as u32),
            ))
        } else {
            None
        }
    }

    pub(crate) fn event_count_since<F: Fn(&ChatEventInternal) -> bool>(&self, since: TimestampMillis, filter: &F) -> usize {
        self.events_map
            .iter()
            .rev()
            .take_while(|e| e.timestamp > since)
            .filter(|e| filter(&e.event))
            .count()
    }

    pub fn remove(&mut self, event_index: EventIndex) -> Option<EventWrapperInternal<ChatEventInternal>> {
        self.events_map.remove(event_index)
    }

    pub fn latest_event_index(&self) -> Option<EventIndex> {
        self.latest_event_index
    }

    pub fn latest_message_index(&self) -> Option<MessageIndex> {
        if self.message_event_indexes.is_empty() {
            None
        } else {
            Some(MessageIndex::from(self.message_event_indexes.len() as u32 - 1))
        }
    }

    pub fn latest_event_timestamp(&self) -> Option<TimestampMillis> {
        self.latest_event_timestamp
    }

    pub fn next_event_index(&self) -> EventIndex {
        self.latest_event_index.map_or(EventIndex::default(), |e| e.incr())
    }

    pub fn next_message_index(&self) -> MessageIndex {
        MessageIndex::from(self.message_event_indexes.len() as u32)
    }

    pub fn last(&self) -> Option<EventWrapperInternal<ChatEventInternal>> {
        self.events_map.iter().next_back()
    }

    pub fn event_index(&self, event_key: EventKey) -> Option<EventIndex> {
        match event_key {
            EventKey::EventIndex(e) => Some(e),
            EventKey::MessageIndex(m) => self.message_event_indexes.get(self.events_map.stable_memory_prefix(), m),
            EventKey::MessageId(m) => self
                .message_ids_on_heap
                .get(&m)
                .copied()
                .or_else(|| self.message_ids().get(&m)),
        }
    }

    // Moves up to `max_count` message ids from the heap into stable memory, returning how many
    // were moved
    pub(crate) fn migrate_message_ids_to_stable_memory(&mut self, max_count: usize) -> usize {
        if self.message_ids_on_heap.is_empty() {
            return 0;
        }

        let batch: Vec<_> = self
            .message_ids_on_heap
            .iter()
            .take(max_count)
            .map(|(m, e)| (*m, *e))
            .collect();

        // `push_event` checks both stores and an imported group's heap ids are discarded, so there
        // can't already be a stable entry for any of these ids. If there were, overwriting it would
        // leave lookups unchanged, since they check the heap first.
        let message_ids = self.message_ids();
        let mut entries: Vec<_> = batch
            .iter()
            .map(|(message_id, event_index)| {
                self.message_ids_on_heap.remove(message_id);
                (
                    message_ids.prefix().create_key(message_id),
                    MessageIdsStableStorage::value_to_bytes(*event_index),
                )
            })
            .collect();
        // The heap entries are unordered, so sort them into key order to minimise the number of
        // nodes written
        entries.sort_unstable_by(|(k1, _), (k2, _)| k1.cmp(k2));
        with_map_mut(|m| m.insert_many(entries));

        if self.message_ids_on_heap.is_empty() {
            // Release the map's allocation
            self.message_ids_on_heap = HashMap::new();
        }

        batch.len()
    }

    // Moves up to `max_count` chunks of message event indexes from the heap into stable memory,
    // returning how many were moved
    pub(crate) fn migrate_message_event_indexes_to_stable_memory(&mut self, max_count: usize) -> usize {
        self.message_event_indexes
            .migrate_to_stable_memory(self.events_map.stable_memory_prefix(), max_count)
    }

    pub(crate) fn message_event_indexes_on_heap_count(&self) -> usize {
        self.message_event_indexes.on_heap_count_to_migrate()
    }

    // See `MessageEventIndexes::copy_to_heap`
    pub(crate) fn copy_message_event_indexes_to_heap(&mut self) {
        self.message_event_indexes
            .copy_to_heap(self.events_map.stable_memory_prefix());
    }

    pub(crate) fn discard_message_ids_on_heap(&mut self) {
        self.message_ids_on_heap = HashMap::new();
    }

    pub(crate) fn message_ids_on_heap_count(&self) -> usize {
        self.message_ids_on_heap.len()
    }

    fn message_ids(&self) -> MessageIdsStableStorage {
        MessageIdsStableStorage::new(self.events_map.stable_memory_prefix())
    }

    fn get_value_or_neighbours(
        &self,
        event_index: EventIndex,
    ) -> Result<EventWrapperInternal<ChatEventInternal>, (Option<EventIndex>, Option<EventIndex>)> {
        let next_key = match self.events_map.range(event_index..).next() {
            Some(v) if v.index == event_index => return Ok(v),
            Some(v) => Some(v.index),
            None => None,
        };
        let previous_key = self.events_map.range(..event_index).next_back().map(|e| e.index);

        Err((previous_key, next_key))
    }
}

pub struct ChatEventsListReader<'r> {
    // The prefix of the chat's main events list, used to look up when events were last updated
    main_events_prefix: &'r ChatEventKeyPrefix,
    events_list: &'r ChatEventsList,
    last_updated_timestamps: &'r LastUpdatedTimestamps,
    min_visible_event_index: EventIndex,
    bot_permitted_event_types: Option<HashSet<ChatEventCategory>>,
}

impl Deref for ChatEventsListReader<'_> {
    type Target = ChatEventsList;

    fn deref(&self) -> &Self::Target {
        self.events_list
    }
}

impl<'r> ChatEventsListReader<'r> {
    pub(crate) fn new(
        main_events_prefix: &'r ChatEventKeyPrefix,
        events_list: &'r ChatEventsList,
        last_updated_timestamps: &'r LastUpdatedTimestamps,
    ) -> ChatEventsListReader<'r> {
        Self::with_min_visible_event_index(
            main_events_prefix,
            events_list,
            last_updated_timestamps,
            EventIndex::default(),
            None,
        )
    }

    pub(crate) fn with_min_visible_event_index(
        main_events_prefix: &'r ChatEventKeyPrefix,
        events_list: &'r ChatEventsList,
        last_updated_timestamps: &'r LastUpdatedTimestamps,
        min_visible_event_index: EventIndex,
        bot_permitted_event_types: Option<HashSet<ChatEventCategory>>,
    ) -> ChatEventsListReader<'r> {
        ChatEventsListReader {
            main_events_prefix,
            events_list,
            last_updated_timestamps,
            min_visible_event_index,
            bot_permitted_event_types,
        }
    }
}

pub trait Reader {
    fn get(&self, event_key: EventKey) -> Option<EventOrExpiredRangeInternal>;
    fn event_index(&self, event_key: EventKey) -> Option<EventIndex>;

    fn iter(&self, start: Option<EventKey>, ascending: bool) -> Box<dyn Iterator<Item = EventOrExpiredRangeInternal> + '_>;
    fn iter_latest_messages(&self, my_user_id: Option<UserId>) -> Box<dyn Iterator<Item = EventWrapper<Message>> + '_>;

    fn iter_events(
        &self,
        start: Option<EventKey>,
        ascending: bool,
    ) -> Box<dyn Iterator<Item = EventWrapperInternal<ChatEventInternal>> + '_> {
        Box::new(self.iter(start, ascending).filter_map(|e| e.into_event()))
    }

    fn get_event(&self, event_key: EventKey) -> Option<EventWrapperInternal<ChatEventInternal>> {
        self.get(event_key).and_then(|e| e.into_event())
    }

    fn get_by_indexes(&self, event_indexes: &[EventIndex], my_user_id: Option<UserId>) -> Vec<EventOrExpiredRange> {
        let mut expired_event_ranges = HashSet::new();
        event_indexes
            .iter()
            .filter_map(|&e| self.get(e.into()))
            .filter(|e| {
                if let EventOrExpiredRangeInternal::ExpiredEventRange(from, to) = e {
                    expired_event_ranges.insert((*from, *to))
                } else {
                    true
                }
            })
            .map(|e| self.hydrate(e, my_user_id))
            .collect()
    }

    fn scan(
        &self,
        start: Option<EventKey>,
        ascending: bool,
        max_messages: usize,
        max_events: usize,
        my_user_id: Option<UserId>,
    ) -> Vec<EventOrExpiredRange> {
        self.cap_then_hydrate_events(self.iter(start, ascending), max_messages, max_events, my_user_id)
    }

    fn window(
        &self,
        start: EventKey,
        max_messages: usize,
        max_events: usize,
        my_user_id: Option<UserId>,
    ) -> Vec<EventOrExpiredRange> {
        let start_event_index = if let Some(e) = self.event_index(start) { e } else { return vec![] };

        // Handle EventIndex::default() as a special case so that in all other cases we can safely
        // decrement the event index
        if start_event_index == EventIndex::default() {
            return self.scan(Some(start), true, max_messages, max_events, my_user_id);
        }

        let forwards_iter = self.iter(Some(start_event_index.into()), true);
        let backwards_iter = self.iter(Some(start_event_index.decr().into()), false);
        let combined = forwards_iter.interleave(backwards_iter);

        self.cap_then_hydrate_events(combined, max_messages, max_events, my_user_id)
    }

    fn message_internal(&self, event_key: EventKey) -> Option<MessageInternal> {
        self.get_event(event_key).and_then(|e| e.event.into_message())
    }

    fn message(&self, event_key: EventKey, my_user_id: Option<UserId>) -> Option<Message> {
        self.message_internal(event_key).map(|m| m.hydrate(my_user_id))
    }

    fn message_event_internal(&self, event_key: EventKey) -> Option<EventWrapper<MessageInternal>> {
        self.get_event(event_key).and_then(|e| {
            if let Some(m) = e.event.into_message() {
                Some(EventWrapper {
                    index: e.index,
                    timestamp: e.timestamp,
                    expires_at: e.expires_at,
                    event: m,
                })
            } else {
                None
            }
        })
    }

    fn message_event(&self, event_key: EventKey, my_user_id: Option<UserId>) -> Option<EventWrapper<Message>> {
        self.get_event(event_key).and_then(|e| try_into_message_event(e, my_user_id))
    }

    fn latest_message_event(&self, my_user_id: Option<UserId>) -> Option<EventWrapper<Message>> {
        self.iter_latest_messages(my_user_id).next()
    }

    fn latest_message_event_if_updated(
        &self,
        since: TimestampMillis,
        my_user_id: Option<UserId>,
    ) -> Option<EventWrapper<Message>>;

    fn hydrate(&self, event_or_expired_range: EventOrExpiredRangeInternal, my_user_id: Option<UserId>) -> EventOrExpiredRange {
        match event_or_expired_range {
            EventOrExpiredRangeInternal::Event(event) => EventOrExpiredRange::Event(self.hydrate_event(event, my_user_id)),
            EventOrExpiredRangeInternal::ExpiredEventRange(from, to) => EventOrExpiredRange::ExpiredEventRange(from, to),
            EventOrExpiredRangeInternal::Unauthorized(event) => EventOrExpiredRange::Unauthorized(event),
        }
    }

    fn hydrate_event(
        &self,
        event: EventWrapperInternal<ChatEventInternal>,
        my_user_id: Option<UserId>,
    ) -> EventWrapper<ChatEvent> {
        let event_data = event.event.chat_event(my_user_id);

        EventWrapper {
            index: event.index,
            timestamp: event.timestamp,
            expires_at: event.expires_at,
            event: event_data,
        }
    }

    fn hydrate_mention(&self, mention: &Mention) -> Option<HydratedMention> {
        self.event_index(mention.message_index.into())
            .map(|event_index| HydratedMention {
                thread_root_message_index: mention.thread_root_message_index,
                message_id: mention.message_id,
                message_index: mention.message_index,
                event_index,
            })
    }

    fn cap_then_hydrate_events(
        &self,
        iterator: impl Iterator<Item = EventOrExpiredRangeInternal>,
        max_messages: usize,
        max_events: usize,
        my_user_id: Option<UserId>,
    ) -> Vec<EventOrExpiredRange> {
        let mut message_count = 0;
        iterator
            .take(max_events)
            .take_while(move |e| {
                if message_count < max_messages {
                    if e.is_message() {
                        message_count += 1;
                    }
                    true
                } else {
                    false
                }
            })
            .map(|e| self.hydrate(e, my_user_id))
            .collect()
    }
}

impl Reader for ChatEventsListReader<'_> {
    fn get(&self, event_key: EventKey) -> Option<EventOrExpiredRangeInternal> {
        self.events_list.get(
            event_key,
            self.min_visible_event_index,
            self.bot_permitted_event_types.as_ref(),
        )
    }

    fn event_index(&self, event_key: EventKey) -> Option<EventIndex> {
        self.events_list.event_index(event_key)
    }

    fn iter(&self, start: Option<EventKey>, ascending: bool) -> Box<dyn Iterator<Item = EventOrExpiredRangeInternal> + '_> {
        self.events_list.iter(
            start,
            ascending,
            self.min_visible_event_index,
            self.bot_permitted_event_types.clone(),
        )
    }

    fn iter_latest_messages(&self, my_user_id: Option<UserId>) -> Box<dyn Iterator<Item = EventWrapper<Message>> + '_> {
        Box::new(
            self.events_list
                .message_event_indexes
                .iter_rev(self.events_list.events_map.stable_memory_prefix())
                .map_while(|e| self.events_list.get_event(e.into(), self.min_visible_event_index, None))
                .filter_map(move |e| try_into_message_event(e, my_user_id)),
        )
    }

    fn latest_message_event_if_updated(
        &self,
        since: TimestampMillis,
        my_user_id: Option<UserId>,
    ) -> Option<EventWrapper<Message>> {
        self.latest_message_event(my_user_id).filter(|m| {
            m.timestamp > since
                || (self.last_updated_timestamps.latest_update().is_some_and(|ts| ts > since)
                    && self
                        .last_updated_timestamps
                        .last_updated(self.main_events_prefix, None, m.index)
                        .is_some_and(|ts| ts > since))
        })
    }
}

fn try_into_message_event(
    event: EventWrapperInternal<ChatEventInternal>,
    my_user_id: Option<UserId>,
) -> Option<EventWrapper<Message>> {
    let message = event.event.into_message()?;

    Some(EventWrapper {
        index: event.index,
        timestamp: event.timestamp,
        expires_at: event.expires_at,
        event: message.hydrate(my_user_id),
    })
}

struct ChatEventsListIterator<I: Iterator> {
    inner: Peekable<I>,
    ascending: bool,
    expected_next: EventIndex,
    end: EventIndex,
    complete: bool,
    bot_permitted_event_types: Option<HashSet<ChatEventCategory>>,
}

impl<I: Iterator<Item = EventWrapperInternal<ChatEventInternal>>> Iterator for ChatEventsListIterator<I> {
    type Item = EventOrExpiredRangeInternal;

    fn next(&mut self) -> Option<Self::Item> {
        if self.complete {
            return None;
        }

        let result = if let Some(next) = self.inner.peek() {
            let index = next.index;
            let result = if next.index == self.expected_next {
                let event = self.inner.next().unwrap();
                if self.ascending {
                    self.expected_next = index.incr();
                } else {
                    self.expected_next = index.decr();
                }

                if self
                    .bot_permitted_event_types
                    .as_ref()
                    .is_none_or(|pt| event.event.event_category().is_some_and(|t| pt.contains(&t)))
                {
                    EventOrExpiredRangeInternal::Event(event)
                } else {
                    EventOrExpiredRangeInternal::Unauthorized(index)
                }
            } else {
                let expired_range =
                    if self.ascending { (self.expected_next, index.decr()) } else { (index.incr(), self.expected_next) };

                self.expected_next = index;
                EventOrExpiredRangeInternal::ExpiredEventRange(expired_range.0, expired_range.1)
            };

            if (self.ascending && self.expected_next > self.end) || (!self.ascending && self.expected_next < self.end) {
                self.complete = true;
            }

            result
        } else {
            self.complete = true;

            let expired_range = if self.ascending { (self.expected_next, self.end) } else { (self.end, self.expected_next) };

            if expired_range.1 <= expired_range.0 {
                return None;
            }

            EventOrExpiredRangeInternal::ExpiredEventRange(expired_range.0, expired_range.1)
        };

        Some(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{ChatEvents, MessageContentInternal, NullEventPusher, PushMessageArgs, TextContentInternal};
    use candid::Principal;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use rand::random;
    use serde_bytes::ByteBuf;
    use stable_memory_map::{ChatEventKeyPrefix, Key, KeyPrefix, with_map, with_map_mut};
    use std::mem::size_of;
    use types::{ChannelId, Chat, EventContext, Milliseconds, MultiUserChat, UserId};

    #[test]
    fn enum_size() {
        let size = size_of::<ChatEventInternal>();
        assert_eq!(size, 16);
    }

    #[test]
    fn delete_partial_history() {
        let mut events = setup_events(None);

        let result = events.remove_old_events_batch(6, 102, 200);

        assert_eq!(result.events.len(), 4);

        let results: Vec<_> = events
            .main_events_list()
            .iter(None, true, EventIndex::default(), None)
            .collect();

        // created, 1 deleted range, 96 messages
        assert_eq!(results.len(), 98);
    }

    #[test]
    fn delete_all_history_but_one() {
        let mut events = setup_events(None);

        let result = events.remove_old_events_batch(101, 102, 200);

        assert_eq!(result.events.len(), 99);

        let results: Vec<_> = events
            .main_events_list()
            .iter(None, true, EventIndex::default(), None)
            .collect();

        // created, 1 deleted range, 1 message
        assert_eq!(results.len(), 3);

        // Last element should be an event not an expired range
        assert!(matches!(results.last().unwrap(), EventOrExpiredRangeInternal::Event(_)));
    }

    #[test]
    fn get() {
        let events = setup_events(None);
        let events_reader = events.main_events_reader();

        let event_by_message_index = events_reader.get_event(EventKey::MessageIndex(10.into())).unwrap();
        let event_by_event_index = events_reader.get_event(event_by_message_index.index.into()).unwrap();
        let event_by_message_id = events_reader
            .get_event(event_by_message_index.event.into_message().unwrap().message_id.into())
            .unwrap();

        assert_eq!(event_by_message_index.index, event_by_event_index.index);
        assert_eq!(event_by_message_index.index, event_by_message_id.index);
    }

    #[test]
    fn get_before_min_visible_returns_none() {
        let events = setup_events(None);
        let events_reader = events.visible_main_events_reader(10.into());

        assert!(events_reader.get_event(EventKey::EventIndex(10.into())).is_some());
        assert!(events_reader.get_event(EventKey::EventIndex(9.into())).is_none());
    }

    #[test]
    fn scan_ascending_from_start() {
        let events = setup_events(None);
        let events_reader = events.main_events_reader();

        let results = events_reader.scan(None, true, usize::MAX, usize::MAX, None);

        let event_indexes: Vec<usize> = results.iter().map(|e| e.as_event().unwrap().index.into()).collect();

        assert_eq!(
            event_indexes,
            (0..=events_reader.latest_event_index().unwrap().into()).collect_vec()
        );
    }

    #[test]
    fn scan_descending_from_end() {
        let events = setup_events(None);
        let events_reader = events.main_events_reader();

        let results = events_reader.scan(None, false, usize::MAX, usize::MAX, None);

        let event_indexes: Vec<usize> = results.iter().map(|e| e.as_event().unwrap().index.into()).collect();

        assert_eq!(
            event_indexes,
            (0..=events_reader.latest_event_index().unwrap().into()).rev().collect_vec()
        );
    }

    #[test]
    fn scan_ascending() {
        let events = setup_events(None);
        let events_reader = events.main_events_reader();

        let start: MessageIndex = 20.into();

        let results = events_reader.scan(Some(EventKey::MessageIndex(start)), true, usize::MAX, usize::MAX, None);

        let first = &results.first().unwrap().as_event().unwrap();

        if let ChatEvent::Message(m) = &first.event {
            assert_eq!(start, m.message_index);
        } else {
            panic!();
        }

        let event_indexes: Vec<usize> = results.iter().map(|e| e.as_event().unwrap().index.into()).collect();

        assert_eq!(
            event_indexes,
            (usize::from(first.index)..=events_reader.latest_event_index().unwrap().into()).collect_vec()
        );
    }

    #[test]
    fn scan_descending() {
        let events = setup_events(None);
        let events_reader = events.main_events_reader();

        let start = 30.into();

        let results = events_reader.scan(Some(EventKey::MessageIndex(start)), false, usize::MAX, usize::MAX, None);

        let first = &results.first().unwrap().as_event().unwrap();

        if let ChatEvent::Message(m) = &first.event {
            assert_eq!(start, m.message_index);
        } else {
            panic!();
        }

        let event_indexes: Vec<usize> = results.iter().map(|e| e.as_event().unwrap().index.into()).collect();

        assert_eq!(event_indexes, (0..=first.index.into()).rev().collect_vec());
    }

    // A caller whose min visible index is above the requested start (stale client summary,
    // role change, lapsed membership) must get nothing back rather than a trap
    #[test]
    fn scan_descending_below_min_visible_returns_empty() {
        let events = setup_group_events();
        let events_reader = events.visible_main_events_reader(50.into());

        let results = events_reader.scan(Some(EventKey::EventIndex(30.into())), false, usize::MAX, usize::MAX, None);

        assert!(results.is_empty());
    }

    #[test]
    fn scan_ascending_below_min_visible_starts_at_min_visible() {
        let events = setup_group_events();
        let events_reader = events.visible_main_events_reader(50.into());

        let results = events_reader.scan(Some(EventKey::EventIndex(30.into())), true, usize::MAX, usize::MAX, None);

        let event_indexes: Vec<usize> = results.iter().map(|e| e.as_event().unwrap().index.into()).collect();
        assert_eq!(event_indexes[0], 50);
    }

    #[test]
    fn window_below_min_visible_returns_only_visible_events() {
        let events = setup_group_events();
        let events_reader = events.visible_main_events_reader(50.into());

        let results = events_reader.window(EventKey::EventIndex(30.into()), usize::MAX, usize::MAX, None);

        let event_indexes: Vec<usize> = results.iter().map(|e| e.as_event().unwrap().index.into()).collect();
        assert!(!event_indexes.is_empty());
        assert!(event_indexes.iter().all(|i| *i >= 50));
    }

    #[test]
    fn window_at_min_visible_does_not_panic() {
        let events = setup_group_events();
        let events_reader = events.visible_main_events_reader(50.into());

        let results = events_reader.window(EventKey::EventIndex(50.into()), usize::MAX, usize::MAX, None);

        let event_indexes: Vec<usize> = results.iter().map(|e| e.as_event().unwrap().index.into()).collect();
        assert!(!event_indexes.is_empty());
        assert!(event_indexes.iter().all(|i| *i >= 50));
    }

    #[test]
    fn window_message_limit() {
        let events = setup_events(None);
        let events_reader = events.main_events_reader();

        let start = 30.into();

        let results = events_reader.window(EventKey::MessageIndex(start), 5, usize::MAX, None);

        let messages: Vec<_> = results
            .iter()
            .filter_map(|e| if let ChatEvent::Message(m) = &e.as_event().unwrap().event { Some(m.message_index) } else { None })
            .sorted()
            .collect();

        assert_eq!(messages, (28..=32).map(|i| i.into()).collect_vec());
    }

    #[test]
    fn window_event_limit() {
        let events = setup_events(None);
        let events_reader = events.main_events_reader();

        let start = 40.into();

        let results = events_reader.window(EventKey::EventIndex(start), usize::MAX, 15, None);

        let event_indexes: Vec<_> = results.into_iter().map(|e| e.as_event().unwrap().index).sorted().collect();

        assert_eq!(event_indexes, (33..=47).map(|i| i.into()).collect_vec());
    }

    #[test]
    fn window_min_visible_event_index() {
        let events = setup_events(None);
        let events_reader = events.visible_main_events_reader(46.into());

        let start = 50.into();

        let results = events_reader.window(EventKey::EventIndex(start), usize::MAX, 25, None);

        let event_indexes: Vec<_> = results.into_iter().map(|e| e.as_event().unwrap().index).sorted().collect();

        assert_eq!(event_indexes, (46..=70).map(|i| i.into()).collect_vec());
    }

    #[test]
    fn message_ids_are_stored_in_stable_memory() {
        let events = setup_events(None);
        let events_list = events.main_events_list();

        assert_eq!(events_list.message_ids_on_heap_count(), 0);

        for message_id in pushed_message_ids(2) {
            let event_index = events_list.event_index(EventKey::MessageId(message_id)).unwrap();
            assert_eq!(events_list.message_ids().get(&message_id), Some(event_index));
            let event = events_list.get_event(EventKey::EventIndex(event_index), EventIndex::default(), None);
            assert!(matches!(event.unwrap().event, ChatEventInternal::Message(m) if m.message_id == message_id));
        }
        assert!(events_list.event_index(EventKey::MessageId(1000u64.into())).is_none());
    }

    #[test]
    fn message_ids_on_heap_are_migrated_to_stable_memory() {
        let mut events = setup_events(None);
        move_message_ids_to_heap(&mut events);
        let expected = expected_message_id_event_indexes(&events);

        assert_eq!(events.heap_entries_to_migrate_count(), 100);
        assert_message_id_lookups(&events, &expected);

        assert_eq!(events.migrate_to_stable_memory(30), 30);
        assert_eq!(events.heap_entries_to_migrate_count(), 70);
        assert_message_id_lookups(&events, &expected);

        assert_eq!(events.migrate_to_stable_memory(1000), 70);
        assert_eq!(events.heap_entries_to_migrate_count(), 0);
        assert_message_id_lookups(&events, &expected);

        let events_list = events.main_events_list();
        for (message_id, event_index) in expected {
            assert_eq!(events_list.message_ids().get(&message_id), Some(event_index));
        }

        assert_eq!(events.migrate_to_stable_memory(1000), 0);
    }

    #[test]
    #[should_panic(expected = "MessageId already used")]
    fn duplicate_message_id_in_stable_memory_panics() {
        let mut events = setup_events(None);
        push_events(&mut events, 2);
    }

    #[test]
    #[should_panic(expected = "MessageId already used")]
    fn duplicate_message_id_on_heap_panics() {
        let mut events = setup_events(None);
        move_message_ids_to_heap(&mut events);
        push_events(&mut events, 2);
    }

    #[test]
    fn message_ids_on_heap_survive_serialization() {
        let mut events = setup_events(None);
        move_message_ids_to_heap(&mut events);
        let expected = expected_message_id_event_indexes(&events);

        let bytes = msgpack::serialize_then_unwrap(events.main_events_list());
        // Must keep the field name used by the previous version so that upgrades and rollbacks both work
        assert!(bytes.windows(14).any(|w| w == b"message_id_map"));

        let deserialized: ChatEventsList = msgpack::deserialize_then_unwrap(&bytes);
        assert_eq!(
            deserialized.message_ids_on_heap,
            events.main_events_list().message_ids_on_heap
        );
        assert_eq!(deserialized.message_ids_on_heap_count(), 100);
        for (message_id, event_index) in expected {
            assert_eq!(deserialized.event_index(EventKey::MessageId(message_id)), Some(event_index));
        }
    }

    #[test]
    fn import_events_writes_message_ids() {
        let events = setup_group_events();
        let expected = expected_message_id_event_indexes(&events);
        let channel = Chat::Channel(Principal::from_slice(&[3]).into(), ChannelId::from(1u32));

        let exported = export_events(&events);
        assert!(!exported.is_empty());

        let imported_message_ids = MessageIdsStableStorage::new(&ChatEventKeyPrefix::new_from_chat(channel, None));
        assert!(imported_message_ids.get(&expected[0].0).is_none());

        ChatEvents::import_events(channel, exported.clone());

        let exported_event_indexes: HashSet<_> = exported.iter().map(|(c, _)| c.event_index).collect();
        let mut imported_count = 0;
        for (message_id, event_index) in expected {
            if exported_event_indexes.contains(&event_index) {
                assert_eq!(imported_message_ids.get(&message_id), Some(event_index));
                imported_count += 1;
            }
        }
        assert!(imported_count > 0);
    }

    #[test]
    fn importing_group_discards_message_ids_on_heap() {
        let mut events = setup_group_events();
        // The group hasn't yet moved its message ids into stable memory
        move_message_ids_to_heap(&mut events);
        let expected = expected_message_id_event_indexes(&events);
        let (removed, remaining) = expected.split_at(10);
        for (_, event_index) in removed {
            events.remove_event(*event_index, 1000).unwrap();
        }

        let channel = Chat::Channel(Principal::from_slice(&[3]).into(), ChannelId::from(1u32));
        ChatEvents::import_events(channel, export_events(&events));

        let mut imported: ChatEvents = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&events));
        imported.set_chat(channel);
        imported.discard_message_ids_on_heap();

        assert_eq!(imported.heap_entries_to_migrate_count(), 0);
        assert_message_id_lookups(&imported, remaining);
        for (message_id, _) in removed {
            assert!(
                imported
                    .main_events_list()
                    .event_index(EventKey::MessageId(*message_id))
                    .is_none()
            );
        }
    }

    #[test]
    fn message_event_indexes_are_chunked_into_stable_memory() {
        let mut events = setup_events(Some(1000));
        push_events(&mut events, 200);
        push_events(&mut events, 400);
        let expected = expected_message_event_indexes(&events);
        assert_eq!(expected.len(), 300);

        let events_list = events.main_events_list();
        assert_eq!(events_list.latest_message_index(), Some(299.into()));
        assert_eq!(events_list.next_message_index(), 300.into());
        assert_eq!(events.heap_entries_to_migrate_count(), 0);
        assert_eq!(events_list.message_event_indexes_on_heap_count(), 0);
        assert_message_index_lookups(&events, &expected);

        // The messages pushed at 2..102 expire at 1002..1102
        let removed = events.remove_expired_events(1051).events;
        assert_eq!(removed.len(), 50);
        assert_eq!(
            events
                .main_events_list()
                .convert_to_message_ranges(&[(expected[0], expected[49])]),
            vec![(0.into(), 49.into())]
        );

        let reader = events.main_events_reader();
        let latest: Vec<_> = reader.iter_latest_messages(None).map(|m| m.index).collect();
        assert_eq!(latest, expected[50..].iter().rev().copied().collect_vec());
    }

    #[test]
    fn importing_group_carries_over_message_event_indexes() {
        let mut events = setup_group_events();
        push_events(&mut events, 200);
        push_events(&mut events, 400);
        let expected = expected_message_event_indexes(&events);

        // As done by the group before it is serialized for the community
        events.copy_to_heap_for_export();
        assert_eq!(events.main_events_list().message_event_indexes_on_heap_count(), 2);
        assert_message_index_lookups(&events, &expected);

        let channel = Chat::Channel(Principal::from_slice(&[3]).into(), ChannelId::from(1u32));
        ChatEvents::import_events(channel, export_events(&events));

        let mut imported: ChatEvents = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&events));
        imported.set_chat(channel);
        imported.discard_message_ids_on_heap();
        imported.discard_expiring_events_on_heap();
        assert_message_index_lookups(&imported, &expected);

        while imported.migrate_to_stable_memory(1) > 0 {}
        assert_eq!(imported.heap_entries_to_migrate_count(), 0);
        assert_eq!(imported.main_events_list().message_event_indexes_on_heap_count(), 0);
        assert_message_index_lookups(&imported, &expected);

        let events_prefix = ChatEventKeyPrefix::new_from_chat(channel, None);
        let chunks_key_prefix = stable_memory_map::MessageEventIndexesKeyPrefix::from(&events_prefix);
        for chunk_index in 0..2 {
            assert!(stable_memory_map::with_map(
                |m| m.contains_key(chunks_key_prefix.create_key(&chunk_index))
            ));
        }
        assert!(!stable_memory_map::with_map(
            |m| m.contains_key(chunks_key_prefix.create_key(&2))
        ));
    }

    #[test]
    fn expired_events_are_removed() {
        let mut events = setup_events(Some(1000));
        assert_eq!(events.heap_entries_to_migrate_count(), 0);

        // The messages were pushed at 2..102, so expire at 1002..1102
        assert_eq!(events.next_event_expiry(), Some(1002));
        assert_eq!(events.remove_expired_events(1001).events.len(), 0);

        let result = events.remove_expired_events(1051);
        assert_eq!(result.events.len(), 50);
        assert_eq!(events.next_event_expiry(), Some(1052));

        let events_list = events.main_events_list();
        for i in 1..=100u32 {
            let event = events_list.get_event(EventKey::EventIndex(i.into()), EventIndex::default(), None);
            assert_eq!(event.is_some(), i > 50);
        }

        assert_eq!(events.remove_expired_events(2000).events.len(), 50);
        assert_eq!(events.next_event_expiry(), None);
    }

    #[test]
    fn import_events_writes_expiring_events() {
        let events = setup_events(Some(1000));
        let channel = Chat::Channel(Principal::from_slice(&[3]).into(), ChannelId::from(1u32));
        ChatEvents::import_events(channel, export_events(&events));

        let mut imported: ChatEvents = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&events));
        imported.set_chat(channel);
        imported.discard_message_ids_on_heap();
        imported.discard_expiring_events_on_heap();
        assert_eq!(imported.heap_entries_to_migrate_count(), 0);
        assert_eq!(imported.next_event_expiry(), Some(1002));

        // Every message expires, but the `DirectChatCreated` event doesn't
        assert_eq!(imported.remove_expired_events(u64::MAX).events.len(), 100);
        assert_eq!(imported.next_event_expiry(), None);
        let events_list = imported.main_events_list();
        for i in 0..=100u32 {
            let event = events_list.get_event(EventKey::EventIndex(i.into()), EventIndex::default(), None);
            assert_eq!(event.is_some(), i == 0);
        }
    }

    fn export_events(events: &ChatEvents) -> Vec<(EventContext, ByteBuf)> {
        let mut exported = Vec::new();
        loop {
            let batch =
                events.read_events_as_bytes_from_stable_memory(exported.last().map(|(c, _): &(EventContext, _)| c.clone()));
            if batch.is_empty() {
                return exported;
            }
            exported.extend(batch);
        }
    }

    fn pushed_message_ids(now: TimestampMillis) -> Vec<MessageId> {
        (0..100).map(|i| MessageId::from((now + i) as u128)).collect()
    }

    fn expected_message_id_event_indexes(events: &ChatEvents) -> Vec<(MessageId, EventIndex)> {
        pushed_message_ids(2)
            .into_iter()
            .map(|m| (m, events.main_events_list().event_index(EventKey::MessageId(m)).unwrap()))
            .collect()
    }

    fn assert_message_id_lookups(events: &ChatEvents, expected: &[(MessageId, EventIndex)]) {
        for (message_id, event_index) in expected {
            assert_eq!(
                events.main_events_list().event_index(EventKey::MessageId(*message_id)),
                Some(*event_index)
            );
        }
    }

    // Recreates the state of a chat from before message ids were stored in stable memory
    fn move_message_ids_to_heap(events: &mut ChatEvents) {
        let events_list = events.main_events_list_mut();
        let mut message_ids = events_list.message_ids();
        for message_id in pushed_message_ids(2) {
            let event_index = *message_ids.remove(&message_id).unwrap().value();
            events_list.message_ids_on_heap.insert(message_id, event_index);
        }
    }

    fn expected_message_event_indexes(events: &ChatEvents) -> Vec<EventIndex> {
        let events_list = events.main_events_list();
        (0..u32::from(events_list.next_message_index()))
            .map(|i| events_list.event_index(EventKey::MessageIndex(i.into())).unwrap())
            .collect()
    }

    fn assert_message_index_lookups(events: &ChatEvents, expected: &[EventIndex]) {
        let events_list = events.main_events_list();
        assert_eq!(usize::from(events_list.next_message_index()), expected.len());
        for (message_index, event_index) in expected.iter().enumerate() {
            assert_eq!(
                events_list.event_index(EventKey::MessageIndex((message_index as u32).into())),
                Some(*event_index)
            );
        }
    }

    // Group chats keep recent events in the in-memory fast map, whose range() traps on an
    // inverted range, unlike the stable memory map direct chats use
    fn setup_group_events() -> ChatEvents {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));

        let mut events = ChatEvents::new_group_chat(
            MultiUserChat::Group(Principal::from_slice(&[1]).into()),
            "name".to_string(),
            "description".to_string(),
            Principal::from_slice(&[2]).into(),
            None,
            random(),
            1,
        );

        push_events(&mut events, 2);

        events
    }

    #[test]
    fn thread_stable_memory_key_prefixes_can_be_built_after_thread_removed() {
        let mut events = setup_events(None);
        let root_message_index = MessageIndex::from(0);

        events.push_message::<NullEventPusher>(
            PushMessageArgs {
                sender: Principal::from_slice(&[2]).into(),
                thread_root_message_index: Some(root_message_index),
                message_id: MessageId::from(1_000_000u128),
                content: MessageContentInternal::Text(TextContentInternal {
                    text: "hello".to_string(),
                }),
                sender_context: None,
                mentioned: Vec::new(),
                replies_to: None,
                now: 200,
                forwarded: false,
                sender_is_bot: false,
                block_level_markdown: false,
                og_previews: Vec::new(),
            },
            None,
        );

        let thread_prefixes = events.thread_stable_memory_key_prefixes(root_message_index);
        let all_prefixes = events.all_stable_memory_key_prefixes();
        assert!(!thread_prefixes.is_empty());
        assert!(thread_prefixes.iter().all(|p| all_prefixes.contains(p)));

        let result = events.remove_old_events_batch(1000, 1000, 200);
        assert!(result.threads.iter().any(|t| t.root_message_index == root_message_index));
        assert!(events.thread_keys().next().is_none());

        // The thread's list has been removed but its prefixes can still be built for garbage collection
        assert_eq!(events.thread_stable_memory_key_prefixes(root_message_index), thread_prefixes);
    }

    #[test]
    fn direct_chat_events_are_migrated_from_legacy_keys() {
        let them: UserId = Principal::from_slice(&[1]).into();
        let mut events = setup_events(None);
        push_events(&mut events, 1000);
        push_events(&mut events, 2000);
        let root_message_index = MessageIndex::from(0);
        for i in 0..5u128 {
            events.push_message::<NullEventPusher>(
                PushMessageArgs {
                    sender: Principal::from_slice(&[2]).into(),
                    thread_root_message_index: Some(root_message_index),
                    message_id: MessageId::from(1_000_000 + i),
                    content: MessageContentInternal::Text(TextContentInternal {
                        text: "hello".to_string(),
                    }),
                    sender_context: None,
                    mentioned: Vec::new(),
                    replies_to: None,
                    now: 3000 + i as u64,
                    forwarded: false,
                    sender_is_bot: false,
                    block_level_markdown: false,
                    og_previews: Vec::new(),
                },
                None,
            );
        }
        let main_indexes = event_indexes(&events, None);
        let thread_indexes = event_indexes(&events, Some(root_message_index));
        assert_eq!(main_indexes.len(), 301);
        assert_eq!(thread_indexes.len(), 5);

        // Recreate the layout of a chat from before `key_id`s were introduced
        let legacy_prefix = ChatEventKeyPrefix::new_from_direct_chat_legacy(them, None);
        let legacy_thread_prefix = legacy_prefix.for_thread(root_message_index);
        move_events_to_legacy_keys(events.main_events_list_mut(), legacy_prefix.clone());
        move_events_to_legacy_keys(
            events.thread_events_list_mut(root_message_index).unwrap(),
            legacy_thread_prefix.clone(),
        );
        assert_eq!(events.stable_memory_prefix(), &legacy_prefix);
        assert!(!events.has_legacy_events());
        assert_eq!(keys_under(&legacy_prefix), main_indexes);
        assert_eq!(keys_under(&legacy_thread_prefix), thread_indexes);

        // The chat's other entries were written under the prefixes of `key_id` 1 when it was
        // created, so it is assigned that `key_id` again. In production those entries are still on
        // the heap when a chat is assigned its `key_id`, and are only written to stable memory
        // afterwards.
        let new_prefix = ChatEventKeyPrefix::new_from_direct_chat_key_id(1, None);
        let new_thread_prefix = new_prefix.for_thread(root_message_index);
        assert!(events.assign_direct_chat_key_id(1));
        assert!(!events.assign_direct_chat_key_id(2));
        assert!(events.has_legacy_events());
        assert_eq!(events.stable_memory_prefix(), &new_prefix);
        assert_eq!(event_indexes(&events, None), main_indexes);
        assert_eq!(event_indexes(&events, Some(root_message_index)), thread_indexes);

        // Until the migration is complete the legacy keys must be garbage collected if the chat is deleted
        let all_prefixes = events.all_stable_memory_key_prefixes();
        assert!(all_prefixes.contains(&legacy_prefix.clone().into()));
        assert!(all_prefixes.contains(&legacy_thread_prefix.clone().into()));
        assert!(all_prefixes.contains(&new_prefix.clone().into()));
        assert!(all_prefixes.contains(&new_thread_prefix.clone().into()));
        let thread_prefixes = events.thread_stable_memory_key_prefixes(root_message_index);
        assert!(thread_prefixes.contains(&legacy_thread_prefix.clone().into()));
        assert!(thread_prefixes.contains(&new_thread_prefix.clone().into()));

        // Stop after every batch, checking the events remain readable and the state survives being
        // serialized mid-migration
        let mut rounds = 0;
        while !events.migrate_legacy_events_batch() {
            rounds += 1;
            assert!(events.has_legacy_events());
            events = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&events));
            assert!(events.has_legacy_events());
            assert_eq!(event_indexes(&events, None), main_indexes);
            assert_eq!(event_indexes(&events, Some(root_message_index)), thread_indexes);
            assert_eq!(events.stable_memory_prefix(), &new_prefix);
        }
        // 3 full batches from the main events list, then the last event, then the thread's events
        assert_eq!(rounds, 4);
        assert!(!events.has_legacy_events());
        events = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&events));
        assert!(!events.has_legacy_events());
        assert_eq!(event_indexes(&events, None), main_indexes);
        assert_eq!(event_indexes(&events, Some(root_message_index)), thread_indexes);
        assert_eq!(events.stable_memory_prefix(), &new_prefix);
        assert!(!events.assign_direct_chat_key_id(2));

        // Every event is now under the new keys and nothing is left under the legacy keys
        assert!(keys_under(&legacy_prefix).is_empty());
        assert!(keys_under(&legacy_thread_prefix).is_empty());
        assert_eq!(keys_under(&new_prefix), main_indexes);
        assert_eq!(keys_under(&new_thread_prefix), thread_indexes);

        // New events go straight to the new keys
        push_events(&mut events, 4000);
        assert_eq!(event_indexes(&events, None).len(), 401);
        assert_eq!(keys_under(&new_prefix).len(), 401);
        assert!(keys_under(&legacy_prefix).is_empty());
    }

    fn event_indexes(events: &ChatEvents, thread_root_message_index: Option<MessageIndex>) -> Vec<EventIndex> {
        let reader = events
            .events_reader(EventIndex::default(), thread_root_message_index, None)
            .unwrap();
        let ascending: Vec<_> = reader
            .iter(None, true)
            .filter_map(|e| e.into_event())
            .map(|e| e.index)
            .collect();
        let mut descending: Vec<_> = reader
            .iter(None, false)
            .filter_map(|e| e.into_event())
            .map(|e| e.index)
            .collect();
        descending.reverse();
        assert_eq!(ascending, descending);
        for index in ascending.iter() {
            assert_eq!(reader.get_event(EventKey::EventIndex(*index)).map(|e| e.index), Some(*index));
        }
        assert_eq!(reader.latest_event_index(), ascending.last().copied());
        ascending
    }

    fn move_events_to_legacy_keys(list: &mut ChatEventsList, legacy_prefix: ChatEventKeyPrefix) {
        let prefix = list.stable_memory_prefix().clone();
        with_map_mut(|m| {
            let entries: Vec<_> = m
                .range(prefix.create_key(&EventIndex::default())..)
                .take_while(|(k, _)| k.matches_prefix(&prefix))
                .map(|(k, v)| (k.event_index(), v))
                .collect();
            for (index, bytes) in entries {
                m.remove(prefix.create_key(&index));
                m.insert(legacy_prefix.create_key(&index), bytes);
            }
        });
        list.set_stable_memory_prefix(legacy_prefix);
    }

    fn keys_under(prefix: &ChatEventKeyPrefix) -> Vec<EventIndex> {
        with_map(|m| {
            m.range(prefix.create_key(&EventIndex::default())..)
                .take_while(|(k, _)| k.matches_prefix(prefix))
                .map(|(k, _)| k.event_index())
                .collect()
        })
    }

    fn setup_events(events_ttl: Option<Milliseconds>) -> ChatEvents {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));

        let mut events = ChatEvents::new_direct_chat(
            Principal::from_slice(&[2]).into(),
            Principal::from_slice(&[1]).into(),
            1,
            events_ttl,
            random(),
            1,
        );

        push_events(&mut events, 2);

        events
    }

    fn push_events(events: &mut ChatEvents, now: TimestampMillis) {
        let user_id = Principal::from_slice(&[2]).into();

        for i in 0..100 {
            let message_id = MessageId::from((now + i) as u128);
            events.push_message::<NullEventPusher>(
                PushMessageArgs {
                    sender: user_id,
                    thread_root_message_index: None,
                    message_id,
                    content: MessageContentInternal::Text(TextContentInternal {
                        text: "hello".to_string(),
                    }),
                    sender_context: None,
                    mentioned: Vec::new(),
                    replies_to: None,
                    now: now + i,
                    forwarded: false,
                    sender_is_bot: false,
                    block_level_markdown: false,
                    og_previews: Vec::new(),
                },
                None,
            );
        }
    }
}
