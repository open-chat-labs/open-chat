use crate::hybrid_map::HybridMap;
use crate::last_updated_timestamps::LastUpdatedTimestamps;
use crate::stable_memory::ChatEventsStableStorage;
use crate::{ChatEventInternal, EventKey, EventOrExpiredRangeInternal, EventsMap, MessageInternal};
use itertools::Itertools;
use rand::rngs::StdRng;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Vacant;
use std::collections::{BTreeSet, HashMap, HashSet};
use std::ops::Deref;
use tracing::info;
use types::{
    Chat, ChatEvent, ChatEventType, EventIndex, EventOrExpiredRange, EventWrapper, EventWrapperInternal, HydratedMention,
    Mention, Message, MessageId, MessageIndex, TimestampMillis, UserId,
};

#[derive(Serialize, Deserialize)]
pub struct ChatEventsList {
    #[serde(alias = "stable_events_map")]
    events_map: HybridMap<ChatEventsStableStorage>,
    message_id_map: HashMap<MessageId, EventIndex>,
    message_event_indexes: Vec<EventIndex>,
    latest_event_index: Option<EventIndex>,
    latest_event_timestamp: Option<TimestampMillis>,
    #[serde(skip)]
    events_with_duplicate_message_ids: BTreeSet<EventIndex>,
}

impl ChatEventsList {
    pub fn fix_duplicate_message_ids(&mut self, rng: &mut StdRng) -> Option<bool> {
        let message_id_zero_event = self.message_id_map.remove(&MessageId::from(0u64));

        if message_id_zero_event.is_none() && self.message_id_map.len() == self.message_event_indexes.len() {
            return Some(true);
        }

        if self.events_with_duplicate_message_ids.is_empty() {
            self.events_with_duplicate_message_ids = self.message_event_indexes.iter().copied().collect();
            for event_index in self.message_id_map.values() {
                self.events_with_duplicate_message_ids.remove(event_index);
            }
            if let Some(event_index) = message_id_zero_event {
                self.events_with_duplicate_message_ids.insert(event_index);
            }
        }

        let mut count = 0;
        while ic_cdk::api::instruction_counter() < 2_000_000_000 {
            let Some(event_index) = self.events_with_duplicate_message_ids.pop_first() else {
                break;
            };

            if let Some(mut event_wrapper) = self.get_event(event_index.into(), EventIndex::default(), None) {
                if let ChatEventInternal::Message(m) = &mut event_wrapper.event {
                    m.message_id = self.new_message_id(rng);
                    self.message_id_map.insert(m.message_id, event_index);
                    self.events_map.insert(event_wrapper);
                    count += 1;
                }
            }
        }

        info!(count, "MessageIds deduped");
        Some(self.message_id_map.len() == self.message_event_indexes.len())
    }

    fn new_message_id(&self, rng: &mut StdRng) -> MessageId {
        loop {
            let message_id = rng.gen::<MessageId>();
            if !self.message_id_map.contains_key(&message_id) {
                return message_id;
            }
        }
    }

    pub fn set_stable_memory_prefix(&mut self, chat: Chat, thread_root_message_index: Option<MessageIndex>) {
        self.events_map.set_stable_memory_prefix(chat, thread_root_message_index);
    }

    pub fn new(chat: Chat, thread_root_message_index: Option<MessageIndex>) -> Self {
        ChatEventsList {
            events_map: HybridMap::new(chat, thread_root_message_index),
            message_id_map: HashMap::new(),
            message_event_indexes: Vec::new(),
            latest_event_index: None,
            latest_event_timestamp: None,
            events_with_duplicate_message_ids: BTreeSet::new(),
        }
    }

    pub(crate) fn push_event(
        &mut self,
        event: ChatEventInternal,
        correlation_id: u64,
        expires_at: Option<TimestampMillis>,
        now: TimestampMillis,
    ) -> EventIndex {
        let event_index = self.next_event_index();
        if let ChatEventInternal::Message(m) = &event {
            match self.message_id_map.entry(m.message_id) {
                Vacant(e) => e.insert(event_index),
                _ => panic!("MessageId already used: {:?}", m.message_id),
            };
            assert_eq!(self.message_event_indexes.len(), usize::from(m.message_index));
            self.message_event_indexes.push(event_index);
        }

        let event_wrapper = EventWrapperInternal {
            index: event_index,
            timestamp: now,
            correlation_id,
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
        bot_permitted_event_types: Option<&HashSet<ChatEventType>>,
    ) -> Option<EventOrExpiredRangeInternal> {
        let event_index = self.event_index(event_key).filter(|e| *e >= min_visible_event_index)?;

        match self.get_value_or_neighbours(event_index) {
            Ok(event) => {
                if bot_permitted_event_types.is_none_or(|pt| event.event.event_type().is_some_and(|t| pt.contains(&t))) {
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
        bot_permitted_event_types: Option<&HashSet<ChatEventType>>,
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
    ) -> Result<(T, EventIndex), UpdateEventError<E>> {
        if let Some(mut event) = self.get_event(event_key, EventIndex::default(), None) {
            update_event_fn(&mut event).map(|result| {
                let event_index = event.index;
                self.events_map.insert(event);
                (result, event_index)
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
        bot_permitted_event_types: Option<HashSet<ChatEventType>>,
    ) -> Box<dyn Iterator<Item = EventOrExpiredRangeInternal> + '_> {
        let (min, max) = if let Some(start) = start {
            if let Some(index) = self.event_index(start) {
                if ascending {
                    (index, self.latest_event_index.unwrap_or_default())
                } else {
                    (min_visible_event_index, index)
                }
            } else {
                return Box::new(std::iter::empty());
            }
        } else {
            (min_visible_event_index, self.latest_event_index.unwrap_or_default())
        };

        let iter = self.events_map.range(min..=max);

        if ascending {
            Box::new(ChatEventsListIterator {
                inner: iter,
                ascending: true,
                expected_next: min,
                end: max,
                complete: false,
                bot_permitted_event_types,
            })
        } else {
            Box::new(ChatEventsListIterator {
                inner: iter.rev(),
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
        let from_message_index = self.message_event_indexes.partition_point(|&e| e < from);
        let to_message_index = self.message_event_indexes.partition_point(|&e| e <= to).checked_sub(1)?;

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
            EventKey::MessageIndex(m) => self.message_event_indexes.get(usize::from(m)).copied(),
            EventKey::MessageId(m) => self.message_id_map.get(&m).copied(),
        }
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

pub enum UpdateEventError<E = ()> {
    NoChange(E),
    NotFound,
}

pub struct ChatEventsListReader<'r> {
    events_list: &'r ChatEventsList,
    last_updated_timestamps: &'r LastUpdatedTimestamps,
    min_visible_event_index: EventIndex,
    bot_permitted_event_types: Option<HashSet<ChatEventType>>,
}

impl Deref for ChatEventsListReader<'_> {
    type Target = ChatEventsList;

    fn deref(&self) -> &Self::Target {
        self.events_list
    }
}

impl<'r> ChatEventsListReader<'r> {
    pub(crate) fn new(
        events_list: &'r ChatEventsList,
        last_updated_timestamps: &'r LastUpdatedTimestamps,
    ) -> ChatEventsListReader<'r> {
        Self::with_min_visible_event_index(events_list, last_updated_timestamps, EventIndex::default(), None)
    }

    pub(crate) fn with_min_visible_event_index(
        events_list: &'r ChatEventsList,
        last_updated_timestamps: &'r LastUpdatedTimestamps,
        min_visible_event_index: EventIndex,
        bot_permitted_event_types: Option<HashSet<ChatEventType>>,
    ) -> ChatEventsListReader<'r> {
        ChatEventsListReader {
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
                    correlation_id: e.correlation_id,
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
        let event_data = match event.event {
            ChatEventInternal::DirectChatCreated(d) => ChatEvent::DirectChatCreated(d),
            ChatEventInternal::Message(m) => ChatEvent::Message(Box::new(m.hydrate(my_user_id))),
            ChatEventInternal::GroupChatCreated(g) => ChatEvent::GroupChatCreated(*g),
            ChatEventInternal::GroupNameChanged(g) => ChatEvent::GroupNameChanged(*g),
            ChatEventInternal::GroupDescriptionChanged(g) => ChatEvent::GroupDescriptionChanged(*g),
            ChatEventInternal::GroupRulesChanged(g) => ChatEvent::GroupRulesChanged(*g),
            ChatEventInternal::AvatarChanged(g) => ChatEvent::AvatarChanged(*g),
            ChatEventInternal::ParticipantsAdded(p) => ChatEvent::ParticipantsAdded(*p),
            ChatEventInternal::ParticipantsRemoved(p) => ChatEvent::ParticipantsRemoved(*p),
            ChatEventInternal::ParticipantJoined(p) => ChatEvent::ParticipantJoined((*p).into()),
            ChatEventInternal::ParticipantLeft(p) => ChatEvent::ParticipantLeft(*p),
            ChatEventInternal::RoleChanged(r) => ChatEvent::RoleChanged(*r),
            ChatEventInternal::UsersBlocked(u) => ChatEvent::UsersBlocked(*u),
            ChatEventInternal::UsersUnblocked(u) => ChatEvent::UsersUnblocked(*u),
            ChatEventInternal::MessagePinned(p) => ChatEvent::MessagePinned(*p),
            ChatEventInternal::PermissionsChanged(p) => ChatEvent::PermissionsChanged(*p),
            ChatEventInternal::MessageUnpinned(u) => ChatEvent::MessageUnpinned(*u),
            ChatEventInternal::GroupVisibilityChanged(g) => ChatEvent::GroupVisibilityChanged(*g),
            ChatEventInternal::GroupInviteCodeChanged(g) => ChatEvent::GroupInviteCodeChanged(*g),
            ChatEventInternal::ChatFrozen(f) => ChatEvent::ChatFrozen(*f),
            ChatEventInternal::ChatUnfrozen(u) => ChatEvent::ChatUnfrozen(*u),
            ChatEventInternal::EventsTimeToLiveUpdated(u) => ChatEvent::EventsTimeToLiveUpdated(*u),
            ChatEventInternal::GroupGateUpdated(g) => ChatEvent::GroupGateUpdated((*g).into()),
            ChatEventInternal::UsersInvited(e) => ChatEvent::UsersInvited(*e),
            ChatEventInternal::MembersAddedToPublicChannel(m) => ChatEvent::MembersAddedToDefaultChannel(m.as_ref().into()),
            ChatEventInternal::ExternalUrlUpdated(u) => ChatEvent::ExternalUrlUpdated(*u),
            ChatEventInternal::Empty => ChatEvent::Empty,
            ChatEventInternal::FailedToDeserialize => ChatEvent::FailedToDeserialize,
            ChatEventInternal::BotAdded(e) => ChatEvent::BotAdded(e),
            ChatEventInternal::BotRemoved(e) => ChatEvent::BotRemoved(e),
            ChatEventInternal::BotUpdated(e) => ChatEvent::BotUpdated(e),
        };

        EventWrapper {
            index: event.index,
            timestamp: event.timestamp,
            correlation_id: event.correlation_id,
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
                .iter()
                .rev()
                .copied()
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
            m.timestamp > since || self.last_updated_timestamps.last_updated(None, m.index).unwrap_or_default() > since
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
        correlation_id: event.correlation_id,
        expires_at: event.expires_at,
        event: message.hydrate(my_user_id),
    })
}

struct ChatEventsListIterator<I> {
    inner: I,
    ascending: bool,
    expected_next: EventIndex,
    end: EventIndex,
    complete: bool,
    bot_permitted_event_types: Option<HashSet<ChatEventType>>,
}

impl<I: Iterator<Item = EventWrapperInternal<ChatEventInternal>>> Iterator for ChatEventsListIterator<I> {
    type Item = EventOrExpiredRangeInternal;

    fn next(&mut self) -> Option<Self::Item> {
        if self.complete {
            return None;
        }

        let result = if let Some(next) = self.inner.next() {
            let index = next.index;
            let result = if next.index == self.expected_next {
                if self
                    .bot_permitted_event_types
                    .as_ref()
                    .is_none_or(|pt| next.event.event_type().is_some_and(|t| pt.contains(&t)))
                {
                    EventOrExpiredRangeInternal::Event(next)
                } else {
                    EventOrExpiredRangeInternal::Unauthorized(index)
                }
            } else if self.ascending {
                EventOrExpiredRangeInternal::ExpiredEventRange(self.expected_next, index.decr())
            } else {
                EventOrExpiredRangeInternal::ExpiredEventRange(index.incr(), self.expected_next)
            };

            if self.expected_next == self.end {
                self.complete = true;
            } else if self.ascending {
                self.expected_next = index.incr();
            } else {
                self.expected_next = index.decr();
            }

            result
        } else {
            self.complete = true;
            if self.ascending {
                EventOrExpiredRangeInternal::ExpiredEventRange(self.expected_next, self.end)
            } else {
                EventOrExpiredRangeInternal::ExpiredEventRange(self.end, self.expected_next)
            }
        };

        Some(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{ChatEvents, MessageContentInternal, PushMessageArgs, TextContentInternal};
    use candid::Principal;
    use event_store_producer::NullRuntime;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use ic_stable_structures::DefaultMemoryImpl;
    use rand::random;
    use std::mem::size_of;
    use types::{EventsTimeToLiveUpdated, Milliseconds};

    #[test]
    fn enum_size() {
        let size = size_of::<ChatEventInternal>();
        assert_eq!(size, 16);
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

    fn setup_events(events_ttl: Option<Milliseconds>) -> ChatEvents {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init(memory.get(MemoryId::new(1)));

        let mut events = ChatEvents::new_direct_chat(Principal::from_slice(&[1]).into(), events_ttl, random(), 1);

        push_events(&mut events, 0);

        events
    }

    fn push_events(events: &mut ChatEvents, now: TimestampMillis) {
        let user_id = Principal::from_slice(&[2]).into();

        for i in 0..50 {
            let message_id = MessageId::from((now + i) as u128);
            events.push_message::<NullRuntime>(
                PushMessageArgs {
                    sender: user_id,
                    thread_root_message_index: None,
                    message_id,
                    content: MessageContentInternal::Text(TextContentInternal {
                        text: "hello".to_string(),
                    }),
                    bot_context: None,
                    mentioned: Vec::new(),
                    replies_to: None,
                    now,
                    forwarded: false,
                    sender_is_bot: false,
                    block_level_markdown: false,
                    correlation_id: i,
                },
                None,
            );
            events.push_main_event(
                ChatEventInternal::EventsTimeToLiveUpdated(Box::new(EventsTimeToLiveUpdated {
                    updated_by: user_id,
                    new_ttl: Some(i),
                })),
                i,
                now,
            );
        }
    }
}
