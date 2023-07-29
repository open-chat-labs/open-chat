use crate::{ChatEventInternal, ChatInternal, EventKey, MessageInternal};
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Vacant;
use std::collections::{BTreeMap, HashMap};
use std::ops::Deref;
use types::{
    ChatEvent, EventIndex, EventWrapper, EventWrapperInternal, HydratedMention, Mention, Message, MessageId, MessageIndex,
    TimestampMillis, UserId,
};

#[derive(Serialize, Deserialize, Default)]
pub struct ChatEventsList {
    events_map: BTreeMap<EventIndex, EventWrapperInternal<ChatEventInternal>>,
    message_id_map: HashMap<MessageId, EventIndex>,
    message_index_map: BTreeMap<MessageIndex, EventIndex>,
    latest_event_index: Option<EventIndex>,
    latest_event_timestamp: Option<TimestampMillis>,
    latest_message_index: Option<MessageIndex>,
}

impl ChatEventsList {
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
            self.message_index_map.insert(m.message_index, event_index);
            self.latest_message_index = Some(m.message_index);
        }

        self.events_map.insert(
            event_index,
            EventWrapperInternal {
                index: event_index,
                timestamp: now,
                correlation_id,
                expires_at,
                event,
            },
        );
        self.latest_event_index = Some(event_index);
        self.latest_event_timestamp = Some(now);

        event_index
    }

    pub(crate) fn get(
        &self,
        event_key: EventKey,
        min_visible_event_index: EventIndex,
        now: TimestampMillis,
    ) -> Option<&EventWrapperInternal<ChatEventInternal>> {
        self.event_index(event_key)
            .filter(|e| *e >= min_visible_event_index)
            .and_then(|e| self.events_map.get(&e))
            .filter(|e| !e.is_expired(now))
    }

    pub(crate) fn get_mut(
        &mut self,
        event_key: EventKey,
        min_visible_event_index: EventIndex,
        now: TimestampMillis,
    ) -> Option<&mut EventWrapperInternal<ChatEventInternal>> {
        self.event_index(event_key)
            .filter(|e| *e >= min_visible_event_index)
            .and_then(|e| self.events_map.get_mut(&e))
            .filter(|e| !e.is_expired(now))
    }

    pub(crate) fn is_accessible(&self, event_key: EventKey, min_visible_event_index: EventIndex, now: TimestampMillis) -> bool {
        self.get(event_key, min_visible_event_index, now).is_some()
    }

    pub(crate) fn iter(
        &self,
        start: Option<EventKey>,
        ascending: bool,
        min_visible_event_index: EventIndex,
        now: TimestampMillis,
    ) -> Box<dyn Iterator<Item = &EventWrapperInternal<ChatEventInternal>> + '_> {
        let range = if let Some(start) = start {
            if let Some(event_index) = self.get(start, min_visible_event_index, now).map(|e| e.index) {
                if ascending {
                    self.events_map.range(event_index..)
                } else {
                    self.events_map.range(min_visible_event_index..=event_index)
                }
            } else {
                return Box::new(std::iter::empty());
            }
        } else {
            self.events_map.range(min_visible_event_index..)
        };

        let iter = range.map(|(_, e)| e).filter(move |e| !e.is_expired(now));

        if ascending {
            Box::new(iter)
        } else {
            Box::new(iter.rev())
        }
    }

    pub fn values(&self) -> impl Iterator<Item = &EventWrapperInternal<ChatEventInternal>> {
        self.events_map.values()
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

    pub(crate) fn event_count_since<F: Fn(&ChatEventInternal) -> bool>(
        &self,
        since: TimestampMillis,
        now: TimestampMillis,
        filter: &F,
    ) -> usize {
        self.events_map
            .values()
            .rev()
            .take_while(|e| e.timestamp > since)
            .filter(|e| !e.is_expired(now) && filter(&e.event))
            .count()
    }

    pub fn remove_expired_event(&mut self, event_index: EventIndex) -> Option<EventWrapperInternal<ChatEventInternal>> {
        let event = self.events_map.remove(&event_index)?;

        if let ChatEventInternal::Message(m) = &event.event {
            self.message_index_map.remove(&m.message_index);
            self.message_id_map.remove(&m.message_id);
        }

        Some(event)
    }

    pub fn latest_event_index(&self) -> Option<EventIndex> {
        self.latest_event_index
    }

    pub fn latest_message_index(&self) -> Option<MessageIndex> {
        self.latest_message_index
    }

    pub fn latest_event_timestamp(&self) -> Option<TimestampMillis> {
        self.latest_event_timestamp
    }

    pub fn next_event_index(&self) -> EventIndex {
        self.latest_event_index.map_or(EventIndex::default(), |e| e.incr())
    }

    pub fn next_message_index(&self) -> MessageIndex {
        self.latest_message_index.map_or(MessageIndex::default(), |m| m.incr())
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

    fn event_index(&self, event_key: EventKey) -> Option<EventIndex> {
        match event_key {
            EventKey::EventIndex(e) => Some(e),
            EventKey::MessageIndex(m) => self.message_index_map.get(&m).copied(),
            EventKey::MessageId(m) => self.message_id_map.get(&m).copied(),
        }
    }
}

pub struct ChatEventsListReader<'r> {
    events_list: &'r ChatEventsList,
    min_visible_event_index: EventIndex,
    now: TimestampMillis,
}

impl<'r> Deref for ChatEventsListReader<'r> {
    type Target = ChatEventsList;

    fn deref(&self) -> &Self::Target {
        self.events_list
    }
}

impl<'r> ChatEventsListReader<'r> {
    pub(crate) fn new(events_list: &ChatEventsList, now: TimestampMillis) -> ChatEventsListReader {
        Self::with_min_visible_event_index(events_list, EventIndex::default(), now)
    }

    pub(crate) fn with_min_visible_event_index(
        events_list: &ChatEventsList,
        min_visible_event_index: EventIndex,
        now: TimestampMillis,
    ) -> ChatEventsListReader {
        ChatEventsListReader {
            events_list,
            min_visible_event_index,
            now,
        }
    }
}

pub trait Reader {
    fn get(&self, event_key: EventKey) -> Option<&EventWrapperInternal<ChatEventInternal>>;
    fn iter(
        &self,
        start: Option<EventKey>,
        ascending: bool,
    ) -> Box<dyn Iterator<Item = &EventWrapperInternal<ChatEventInternal>> + '_>;
    fn iter_latest_messages(&self, my_user_id: Option<UserId>) -> Box<dyn Iterator<Item = EventWrapper<Message>> + '_>;

    fn event_index(&self, event_key: EventKey) -> Option<EventIndex> {
        self.get(event_key).map(|e| e.index)
    }

    fn get_by_indexes(&self, event_indexes: &[EventIndex], my_user_id: Option<UserId>) -> Vec<EventWrapper<ChatEvent>> {
        event_indexes
            .iter()
            .filter_map(|&e| self.get(e.into()))
            .map(|e| self.hydrate_event(e, my_user_id))
            .collect()
    }

    fn scan(
        &self,
        start: Option<EventKey>,
        ascending: bool,
        max_messages: usize,
        max_events: usize,
        my_user_id: Option<UserId>,
    ) -> Vec<EventWrapper<ChatEvent>> {
        self.cap_then_hydrate_events(self.iter(start, ascending), max_messages, max_events, my_user_id)
    }

    fn window(
        &self,
        start: EventKey,
        max_messages: usize,
        max_events: usize,
        my_user_id: Option<UserId>,
    ) -> Vec<EventWrapper<ChatEvent>> {
        let start_event_index = match self.event_index(start) {
            Some(e) => e,
            // If we can't access the starting event, return empty
            _ => return vec![],
        };

        // Handle EventIndex::default() as a special case so that in all other cases we can safely
        // decrement the event index
        if start_event_index == EventIndex::default() {
            return self.scan(Some(start), true, max_messages, max_events, my_user_id);
        }

        let forwards_iter = self.iter(Some(start_event_index.into()), true);
        let backwards_iter = self.iter(Some(start_event_index.decr().into()), false);
        let combined = forwards_iter.interleave(backwards_iter);

        let mut events = self.cap_then_hydrate_events(combined, max_messages, max_events, my_user_id);
        events.sort_unstable_by_key(|e| e.index);
        events
    }

    fn message_internal(&self, event_key: EventKey) -> Option<&MessageInternal> {
        self.get(event_key).and_then(|e| e.event.as_message())
    }

    fn message(&self, event_key: EventKey, my_user_id: Option<UserId>) -> Option<Message> {
        self.message_internal(event_key).map(|m| m.hydrate(my_user_id))
    }

    fn message_event_internal(&self, event_key: EventKey) -> Option<EventWrapper<&MessageInternal>> {
        self.get(event_key)
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
        self.get(event_key).and_then(|e| try_into_message_event(e, my_user_id))
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
            ChatEventInternal::MembersAddedToDefaultChannel(m) => ChatEvent::MembersAddedToDefaultChannel(m.as_ref().into()),
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
        iterator: impl Iterator<Item = &'a EventWrapperInternal<ChatEventInternal>>,
        max_messages: usize,
        max_events: usize,
        my_user_id: Option<UserId>,
    ) -> Vec<EventWrapper<ChatEvent>> {
        let mut message_count = 0;
        iterator
            .take(max_events)
            .take_while(move |e| {
                if message_count < max_messages {
                    let is_message = matches!(e.event, ChatEventInternal::Message(_));
                    if is_message {
                        message_count += 1;
                    }
                    true
                } else {
                    false
                }
            })
            .map(|e| self.hydrate_event(e, my_user_id))
            .collect()
    }
}

impl<'r> Reader for ChatEventsListReader<'r> {
    fn get(&self, event_key: EventKey) -> Option<&EventWrapperInternal<ChatEventInternal>> {
        self.events_list.get(event_key, self.min_visible_event_index, self.now)
    }

    fn iter(
        &self,
        start: Option<EventKey>,
        ascending: bool,
    ) -> Box<dyn Iterator<Item = &EventWrapperInternal<ChatEventInternal>> + '_> {
        self.events_list
            .iter(start, ascending, self.min_visible_event_index, self.now)
    }

    fn iter_latest_messages(&self, my_user_id: Option<UserId>) -> Box<dyn Iterator<Item = EventWrapper<Message>> + '_> {
        Box::new(
            self.events_list
                .message_index_map
                .values()
                .copied()
                .rev()
                .map_while(|e| self.events_list.get(e.into(), self.min_visible_event_index, self.now))
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{ChatEvents, MessageContentInternal, PushMessageArgs};
    use candid::Principal;
    use std::mem::size_of;
    use types::{EventsTimeToLiveUpdated, Milliseconds, TextContent};

    #[test]
    fn enum_size() {
        let size = size_of::<ChatEventInternal>();
        assert_eq!(size, 16);
    }

    #[test]
    fn get() {
        let events = setup_events(None);
        let events_reader = events.main_events_reader(0);

        let event_by_message_index = events_reader.get(EventKey::MessageIndex(10.into())).unwrap();
        let event_by_event_index = events_reader.get(event_by_message_index.index.into()).unwrap();
        let event_by_message_id = events_reader
            .get(event_by_message_index.event.as_message().unwrap().message_id.into())
            .unwrap();

        assert_eq!(event_by_message_index.index, event_by_event_index.index);
        assert_eq!(event_by_message_index.index, event_by_message_id.index);
    }

    #[test]
    fn get_before_min_visible_returns_none() {
        let events = setup_events(None);
        let events_reader = events.visible_main_events_reader(10.into(), 0);

        assert!(events_reader.get(EventKey::EventIndex(10.into())).is_some());
        assert!(events_reader.get(EventKey::EventIndex(9.into())).is_none());
    }

    #[test]
    fn get_excludes_expired_events() {
        let events = setup_events(Some(100));
        let events_reader1 = events.main_events_reader(100);
        let expires_at = events_reader1
            .get(EventKey::EventIndex(20.into()))
            .unwrap()
            .expires_at
            .unwrap();

        let events_reader2 = events.main_events_reader(expires_at);
        assert!(events_reader2.get(EventKey::EventIndex(20.into())).is_some());

        let events_reader3 = events.main_events_reader(expires_at + 1);
        assert!(events_reader3.get(EventKey::EventIndex(20.into())).is_none());
    }

    #[test]
    fn scan_ascending_from_start() {
        let events = setup_events(None);
        let events_reader = events.main_events_reader(0);

        let results = events_reader.scan(None, true, usize::MAX, usize::MAX, None);

        let event_indexes: Vec<usize> = results.iter().map(|e| e.index.into()).collect();

        assert_eq!(event_indexes, (0..events_reader.len()).collect_vec());
    }

    #[test]
    fn scan_descending_from_end() {
        let events = setup_events(None);
        let events_reader = events.main_events_reader(0);

        let results = events_reader.scan(None, false, usize::MAX, usize::MAX, None);

        let event_indexes: Vec<usize> = results.iter().map(|e| e.index.into()).collect();

        assert_eq!(event_indexes, (0..events_reader.len()).rev().collect_vec());
    }

    #[test]
    fn scan_ascending() {
        let events = setup_events(None);
        let events_reader = events.main_events_reader(0);

        let start: MessageIndex = 20.into();

        let results = events_reader.scan(Some(EventKey::MessageIndex(start)), true, usize::MAX, usize::MAX, None);

        let first = results.first().unwrap();

        if let ChatEvent::Message(m) = &first.event {
            assert_eq!(start, m.message_index);
        } else {
            panic!();
        }

        let event_indexes: Vec<usize> = results.iter().map(|e| e.index.into()).collect();

        assert_eq!(event_indexes, (first.index.into()..events_reader.len()).collect_vec());
    }

    #[test]
    fn scan_descending() {
        let events = setup_events(None);
        let events_reader = events.main_events_reader(0);

        let start = 30.into();

        let results = events_reader.scan(Some(EventKey::MessageIndex(start)), false, usize::MAX, usize::MAX, None);

        let first = results.first().unwrap();

        if let ChatEvent::Message(m) = &first.event {
            assert_eq!(start, m.message_index);
        } else {
            panic!();
        }

        let event_indexes: Vec<usize> = results.iter().map(|e| e.index.into()).collect();

        assert_eq!(event_indexes, (0..=first.index.into()).rev().collect_vec());
    }

    #[test]
    fn iter_skips_expired() {
        let mut events = setup_events(Some(2000)); // These will expire at 2000
        let user_id = Principal::from_slice(&[1]).into();

        events.set_events_time_to_live(user_id, Some(1000), 500);
        push_events(&mut events, 500); // These will expire at 1500
        events.set_events_time_to_live(user_id, Some(1500), 1000);
        push_events(&mut events, 1000); // These will expire at 2500

        let group1 = (0u32..=100).map(EventIndex::from).collect_vec();
        let group2 = (101u32..=201).map(EventIndex::from).collect_vec();
        let group3 = (202u32..=302).map(EventIndex::from).collect_vec();

        let events_reader1 = events.main_events_reader(1250);
        let expected1 = group1.iter().chain(group2.iter()).chain(group3.iter()).copied().collect_vec();
        assert_eq!(events_reader1.iter(None, true).map(|e| e.index).collect_vec(), expected1);

        let events_reader2 = events.main_events_reader(1750);
        let expected2 = group1.iter().chain(group3.iter()).copied().collect_vec();
        assert_eq!(events_reader2.iter(None, true).map(|e| e.index).collect_vec(), expected2);

        let events_reader3 = events.main_events_reader(2250);
        let expected3 = group3;
        assert_eq!(events_reader3.iter(None, true).map(|e| e.index).collect_vec(), expected3);

        let events_reader4 = events.main_events_reader(2750);
        assert_eq!(events_reader4.iter(None, true).map(|e| e.index).collect_vec(), vec![]);
    }

    #[test]
    fn window_message_limit() {
        let events = setup_events(None);
        let events_reader = events.main_events_reader(0);

        let start = 30.into();

        let results = events_reader.window(EventKey::MessageIndex(start), 5, usize::MAX, None);

        let messages: Vec<_> = results
            .iter()
            .filter_map(|e| if let ChatEvent::Message(m) = &e.event { Some(m.message_index) } else { None })
            .collect();

        assert_eq!(messages, (28..=32).map(|i| i.into()).collect_vec());
    }

    #[test]
    fn window_event_limit() {
        let events = setup_events(None);
        let events_reader = events.main_events_reader(0);

        let start = 40.into();

        let results = events_reader.window(EventKey::EventIndex(start), usize::MAX, 15, None);

        let event_indexes: Vec<_> = results.into_iter().map(|e| e.index).collect();

        assert_eq!(event_indexes, (33..=47).map(|i| i.into()).collect_vec());
    }

    #[test]
    fn window_min_visible_event_index() {
        let events = setup_events(None);
        let events_reader = events.visible_main_events_reader(46.into(), 0);

        let start = 50.into();

        let results = events_reader.window(EventKey::EventIndex(start), usize::MAX, 25, None);

        let event_indexes: Vec<_> = results.into_iter().map(|e| e.index).collect();

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
                content: MessageContentInternal::Text(TextContent {
                    text: "hello".to_owned(),
                }),
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
