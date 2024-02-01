use crate::{ChatEventInternal, ChatInternal, EventKey, EventOrExpiredRangeInternal, EventsMap, MessageInternal};
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Vacant;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::ops::Deref;
use types::{
    ChatEvent, EventIndex, EventOrExpiredRange, EventWrapper, EventWrapperInternal, HydratedMention, Mention, Message,
    MessageId, MessageIndex, TimestampMillis, UserId,
};

#[derive(Serialize, Deserialize, Default)]
pub struct ChatEventsList<M = BTreeMap<EventIndex, EventWrapperInternal<ChatEventInternal>>> {
    events_map: M,
    message_id_map: HashMap<MessageId, EventIndex>,
    message_event_indexes: Vec<EventIndex>,
    latest_event_index: Option<EventIndex>,
    latest_event_timestamp: Option<TimestampMillis>,
}

impl<M: EventsMap> ChatEventsList<M> {
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

        self.events_map.insert(EventWrapperInternal {
            index: event_index,
            timestamp: now,
            correlation_id,
            expires_at,
            event,
        });
        self.latest_event_index = Some(event_index);
        self.latest_event_timestamp = Some(now);

        event_index
    }

    pub(crate) fn get(&self, event_key: EventKey, min_visible_event_index: EventIndex) -> Option<EventOrExpiredRangeInternal> {
        let event_index = self.event_index(event_key).filter(|e| *e >= min_visible_event_index)?;

        match self.get_value_or_neighbours(event_index) {
            Ok(event) => Some(EventOrExpiredRangeInternal::Event(event)),
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
    ) -> Option<&EventWrapperInternal<ChatEventInternal>> {
        self.get(event_key, min_visible_event_index).and_then(|e| e.as_event())
    }

    pub(crate) fn get_event_mut(
        &mut self,
        event_key: EventKey,
        min_visible_event_index: EventIndex,
    ) -> Option<&mut EventWrapperInternal<ChatEventInternal>> {
        self.event_index(event_key)
            .filter(|e| *e >= min_visible_event_index)
            .and_then(|e| self.events_map.get_mut(e))
    }

    pub(crate) fn is_accessible(&self, event_key: EventKey, min_visible_event_index: EventIndex) -> bool {
        self.get_event(event_key, min_visible_event_index).is_some()
    }

    pub(crate) fn iter(
        &self,
        start: Option<EventKey>,
        ascending: bool,
        min_visible_event_index: EventIndex,
    ) -> Box<dyn Iterator<Item = EventOrExpiredRangeInternal> + '_> {
        let (min, max) = if let Some(start) = start {
            match self.get(start, min_visible_event_index) {
                Some(EventOrExpiredRangeInternal::Event(event_index)) => {
                    if ascending {
                        (event_index.index, self.latest_event_index.unwrap_or_default())
                    } else {
                        (min_visible_event_index, event_index.index)
                    }
                }
                Some(EventOrExpiredRangeInternal::ExpiredEventRange(from, to)) => {
                    if ascending {
                        (from, self.latest_event_index.unwrap_or_default())
                    } else {
                        (min_visible_event_index, to)
                    }
                }
                None => return Box::new(std::iter::empty()),
            }
        } else {
            (min_visible_event_index, self.latest_event_index.unwrap_or_default())
        };

        let iter = self.events_map.range(min..=max).map(|(_, e)| e);

        if ascending {
            Box::new(ChatEventsListIterator {
                inner: iter,
                ascending: true,
                expected_next: min,
                end: max,
                complete: false,
            })
        } else {
            Box::new(ChatEventsListIterator {
                inner: iter.rev(),
                ascending: false,
                expected_next: max,
                end: min,
                complete: false,
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

    pub fn migrate_replies(&mut self, old: ChatInternal, new: ChatInternal) -> Vec<EventIndex> {
        let mut updated = Vec::new();
        for event in self.events_map.values_mut() {
            if let Some(message) = event.event.as_message_mut() {
                if let Some(r) = message.replies_to.as_mut() {
                    if let Some((chat, _)) = r.chat_if_other.as_mut() {
                        if *chat == old {
                            *chat = new;
                            updated.push(event.index);
                        }
                    }
                }
            }
        }
        updated
    }

    pub(crate) fn event_count_since<F: Fn(&ChatEventInternal) -> bool>(&self, since: TimestampMillis, filter: &F) -> usize {
        self.events_map
            .values()
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

    pub fn last(&self) -> Option<&EventWrapperInternal<ChatEventInternal>> {
        self.events_map.values().next_back()
    }

    pub fn last_mut(&mut self) -> Option<&mut EventWrapperInternal<ChatEventInternal>> {
        self.events_map.values_mut().next_back()
    }

    pub fn len(&self) -> usize {
        self.events_map.len()
    }

    pub fn is_empty(&self) -> bool {
        self.events_map.is_empty()
    }

    pub fn contains_message_id(&self, message_id: MessageId) -> bool {
        self.message_id_map.contains_key(&message_id)
    }

    fn event_index(&self, event_key: EventKey) -> Option<EventIndex> {
        match event_key {
            EventKey::EventIndex(e) => Some(e),
            EventKey::MessageIndex(m) => self.message_event_indexes.get(usize::from(m)).copied(),
            EventKey::MessageId(m) => self.message_id_map.get(&m).copied(),
        }
    }

    fn get_value_or_neighbours(
        &self,
        event_index: EventIndex,
    ) -> Result<&EventWrapperInternal<ChatEventInternal>, (Option<EventIndex>, Option<EventIndex>)> {
        let next_key = match self.events_map.range(event_index..).next() {
            Some((k, v)) if *k == event_index => return Ok(v),
            Some((k, _)) => Some(*k),
            None => None,
        };

        let previous_key = self.events_map.range(..event_index).next_back().map(|(k, _)| *k);

        Err((previous_key, next_key))
    }
}

pub struct ChatEventsListReader<'r, M = BTreeMap<EventIndex, EventWrapperInternal<ChatEventInternal>>> {
    events_list: &'r ChatEventsList<M>,
    min_visible_event_index: EventIndex,
}

impl<'r, M> Deref for ChatEventsListReader<'r, M> {
    type Target = ChatEventsList<M>;

    fn deref(&self) -> &Self::Target {
        self.events_list
    }
}

impl<'r, M: EventsMap + 'r> ChatEventsListReader<'r, M> {
    pub(crate) fn new(events_list: &ChatEventsList<M>) -> ChatEventsListReader<M> {
        Self::with_min_visible_event_index(events_list, EventIndex::default())
    }

    pub(crate) fn with_min_visible_event_index(
        events_list: &ChatEventsList<M>,
        min_visible_event_index: EventIndex,
    ) -> ChatEventsListReader<M> {
        ChatEventsListReader {
            events_list,
            min_visible_event_index,
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
    ) -> Box<dyn Iterator<Item = &EventWrapperInternal<ChatEventInternal>> + '_> {
        Box::new(self.iter(start, ascending).filter_map(|e| e.as_event()))
    }

    fn get_event(&self, event_key: EventKey) -> Option<&EventWrapperInternal<ChatEventInternal>> {
        self.get(event_key).and_then(|e| e.as_event())
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

    fn message_internal(&self, event_key: EventKey) -> Option<&MessageInternal> {
        self.get_event(event_key).and_then(|e| e.event.as_message())
    }

    fn message(&self, event_key: EventKey, my_user_id: Option<UserId>) -> Option<Message> {
        self.message_internal(event_key).map(|m| m.hydrate(my_user_id))
    }

    fn message_event_internal(&self, event_key: EventKey) -> Option<EventWrapper<&MessageInternal>> {
        self.get_event(event_key)
            .and_then(|e| e.event.as_message().map(|m| (e, m)))
            .map(|(e, m)| EventWrapper {
                index: e.index,
                timestamp: e.timestamp,
                correlation_id: e.correlation_id,
                expires_at: e.expires_at,
                event: m,
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
    ) -> Option<EventWrapper<Message>> {
        self.latest_message_event(my_user_id)
            .filter(|m| m.event.last_updated.unwrap_or(m.timestamp) > since)
    }

    fn hydrate(&self, event_or_expired_range: EventOrExpiredRangeInternal, my_user_id: Option<UserId>) -> EventOrExpiredRange {
        match event_or_expired_range {
            EventOrExpiredRangeInternal::Event(event) => EventOrExpiredRange::Event(self.hydrate_event(event, my_user_id)),
            EventOrExpiredRangeInternal::ExpiredEventRange(from, to) => EventOrExpiredRange::ExpiredEventRange(from, to),
        }
    }

    fn hydrate_event(
        &self,
        event: &EventWrapperInternal<ChatEventInternal>,
        my_user_id: Option<UserId>,
    ) -> EventWrapper<ChatEvent> {
        let event_data = match &event.event {
            ChatEventInternal::DirectChatCreated(d) => ChatEvent::DirectChatCreated(*d),
            ChatEventInternal::Message(m) => ChatEvent::Message(Box::new(m.hydrate(my_user_id))),
            ChatEventInternal::GroupChatCreated(g) => ChatEvent::GroupChatCreated(*g.clone()),
            ChatEventInternal::GroupNameChanged(g) => ChatEvent::GroupNameChanged(*g.clone()),
            ChatEventInternal::GroupDescriptionChanged(g) => ChatEvent::GroupDescriptionChanged(*g.clone()),
            ChatEventInternal::GroupRulesChanged(g) => ChatEvent::GroupRulesChanged(*g.clone()),
            ChatEventInternal::AvatarChanged(g) => ChatEvent::AvatarChanged(*g.clone()),
            ChatEventInternal::ParticipantsAdded(p) => ChatEvent::ParticipantsAdded(*p.clone()),
            ChatEventInternal::ParticipantsRemoved(p) => ChatEvent::ParticipantsRemoved(*p.clone()),
            ChatEventInternal::ParticipantJoined(p) => ChatEvent::ParticipantJoined(*p.clone()),
            ChatEventInternal::ParticipantLeft(p) => ChatEvent::ParticipantLeft(*p.clone()),
            ChatEventInternal::RoleChanged(r) => ChatEvent::RoleChanged(*r.clone()),
            ChatEventInternal::UsersBlocked(u) => ChatEvent::UsersBlocked(*u.clone()),
            ChatEventInternal::UsersUnblocked(u) => ChatEvent::UsersUnblocked(*u.clone()),
            ChatEventInternal::MessagePinned(p) => ChatEvent::MessagePinned(*p.clone()),
            ChatEventInternal::PermissionsChanged(p) => ChatEvent::PermissionsChanged(*p.clone()),
            ChatEventInternal::MessageUnpinned(u) => ChatEvent::MessageUnpinned(*u.clone()),
            ChatEventInternal::GroupVisibilityChanged(g) => ChatEvent::GroupVisibilityChanged(*g.clone()),
            ChatEventInternal::GroupInviteCodeChanged(g) => ChatEvent::GroupInviteCodeChanged(*g.clone()),
            ChatEventInternal::ChatFrozen(f) => ChatEvent::ChatFrozen(*f.clone()),
            ChatEventInternal::ChatUnfrozen(u) => ChatEvent::ChatUnfrozen(*u.clone()),
            ChatEventInternal::EventsTimeToLiveUpdated(u) => ChatEvent::EventsTimeToLiveUpdated(*u.clone()),
            ChatEventInternal::GroupGateUpdated(g) => ChatEvent::GroupGateUpdated(*g.clone()),
            ChatEventInternal::UsersInvited(e) => ChatEvent::UsersInvited(*e.clone()),
            ChatEventInternal::MembersAddedToPublicChannel(m) => ChatEvent::MembersAddedToDefaultChannel(m.as_ref().into()),
            ChatEventInternal::Empty => ChatEvent::Empty,
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
        self.message_event_internal(mention.message_index.into())
            .map(|e| HydratedMention {
                thread_root_message_index: mention.thread_root_message_index,
                message_id: e.event.message_id,
                message_index: e.event.message_index,
                event_index: e.index,
                mentioned_by: e.event.sender,
            })
    }

    fn cap_then_hydrate_events<'a>(
        &self,
        iterator: impl Iterator<Item = EventOrExpiredRangeInternal<'a>>,
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

impl<'r> Reader for ChatEventsListReader<'r> {
    fn get(&self, event_key: EventKey) -> Option<EventOrExpiredRangeInternal> {
        self.events_list.get(event_key, self.min_visible_event_index)
    }

    fn event_index(&self, event_key: EventKey) -> Option<EventIndex> {
        self.events_list.event_index(event_key)
    }

    fn iter(&self, start: Option<EventKey>, ascending: bool) -> Box<dyn Iterator<Item = EventOrExpiredRangeInternal> + '_> {
        self.events_list.iter(start, ascending, self.min_visible_event_index)
    }

    fn iter_latest_messages(&self, my_user_id: Option<UserId>) -> Box<dyn Iterator<Item = EventWrapper<Message>> + '_> {
        Box::new(
            self.events_list
                .message_event_indexes
                .iter()
                .rev()
                .copied()
                .map_while(|e| self.events_list.get_event(e.into(), self.min_visible_event_index))
                .filter_map(move |e| try_into_message_event(e, my_user_id)),
        )
    }
}

fn try_into_message_event(
    event: &EventWrapperInternal<ChatEventInternal>,
    my_user_id: Option<UserId>,
) -> Option<EventWrapper<Message>> {
    let message = event.event.as_message()?;

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
}

impl<'a, I: Iterator<Item = &'a EventWrapperInternal<ChatEventInternal>>> Iterator for ChatEventsListIterator<I> {
    type Item = EventOrExpiredRangeInternal<'a>;

    fn next(&mut self) -> Option<Self::Item> {
        if self.complete {
            return None;
        }

        let result = if let Some(next) = self.inner.next() {
            let result = if next.index == self.expected_next {
                EventOrExpiredRangeInternal::Event(next)
            } else if self.ascending {
                EventOrExpiredRangeInternal::ExpiredEventRange(self.expected_next, next.index.decr())
            } else {
                EventOrExpiredRangeInternal::ExpiredEventRange(next.index.incr(), self.expected_next)
            };

            if self.expected_next == self.end {
                self.complete = true;
            } else if self.ascending {
                self.expected_next = next.index.incr();
            } else {
                self.expected_next = next.index.decr();
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
            .get_event(event_by_message_index.event.as_message().unwrap().message_id.into())
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

        assert_eq!(event_indexes, (0..events_reader.len()).collect_vec());
    }

    #[test]
    fn scan_descending_from_end() {
        let events = setup_events(None);
        let events_reader = events.main_events_reader();

        let results = events_reader.scan(None, false, usize::MAX, usize::MAX, None);

        let event_indexes: Vec<usize> = results.iter().map(|e| e.as_event().unwrap().index.into()).collect();

        assert_eq!(event_indexes, (0..events_reader.len()).rev().collect_vec());
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

        assert_eq!(event_indexes, (first.index.into()..events_reader.len()).collect_vec());
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
        let mut events = ChatEvents::new_direct_chat(events_ttl, 1);

        push_events(&mut events, 0);

        events
    }

    fn push_events(events: &mut ChatEvents, now: TimestampMillis) {
        let user_id = Principal::from_slice(&[2]).into();

        for i in 0..50 {
            let message_id = MessageId::from((now + i) as u128);
            events.push_message(PushMessageArgs {
                sender: user_id,
                thread_root_message_index: None,
                message_id,
                content: MessageContentInternal::Text(TextContentInternal {
                    text: "hello".to_string(),
                }),
                mentioned: Vec::new(),
                replies_to: None,
                now,
                forwarded: false,
                correlation_id: i,
            });
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
