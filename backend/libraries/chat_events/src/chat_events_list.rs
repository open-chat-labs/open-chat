use crate::{
    ChatEventInternal, EventKey, MessageInternal, ProposalsUpdatedInternal, ThreadUpdatedInternal, UpdatedMessageInternal,
};
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Vacant;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::ops::Deref;
use types::{
    ChatEvent, EventIndex, EventWrapper, Mention, MentionInternal, Message, MessageId, MessageIndex, PollEnded,
    PollVoteRegistered, ProposalUpdated, ProposalsUpdated, PushIfNotContains, ThreadSummary, ThreadUpdated, TimestampMillis,
    UpdatedMessage, UserId,
};

#[derive(Serialize, Deserialize, Default)]
#[serde(from = "ChatEventsListOld")]
pub struct ChatEventsList {
    events_map: BTreeMap<EventIndex, EventWrapper<ChatEventInternal>>,
    message_id_map: HashMap<MessageId, EventIndex>,
    message_index_map: BTreeMap<MessageIndex, EventIndex>,
    latest_event_index: Option<EventIndex>,
    latest_message_index: Option<MessageIndex>,
}

#[derive(Deserialize)]
pub(crate) struct ChatEventsListOld {
    pub events: ChatEventsVecOld,
    pub message_id_map: HashMap<MessageId, EventIndex>,
    pub message_index_map: BTreeMap<MessageIndex, EventIndex>,
}

#[derive(Deserialize)]
pub(crate) struct ChatEventsVecOld {
    pub events: Vec<EventWrapper<ChatEventInternal>>,
}

impl From<ChatEventsListOld> for ChatEventsList {
    fn from(value: ChatEventsListOld) -> Self {
        let latest_event_index = value.events.events.last().map(|e| e.index);
        let latest_message_index = value.message_index_map.keys().rev().next().copied();

        ChatEventsList {
            events_map: value.events.events.into_iter().map(|e| (e.index, e)).collect(),
            message_id_map: value.message_id_map,
            message_index_map: value.message_index_map,
            latest_event_index,
            latest_message_index,
        }
    }
}

impl ChatEventsList {
    pub(crate) fn push_event(
        &mut self,
        event: ChatEventInternal,
        correlation_id: u64,
        disappears_at: Option<TimestampMillis>,
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
            EventWrapper {
                index: event_index,
                timestamp: now,
                correlation_id,
                disappears_at,
                event,
            },
        );
        self.latest_event_index = Some(event_index);

        event_index
    }

    pub(crate) fn get(
        &self,
        event_key: EventKey,
        min_visible_event_index: EventIndex,
    ) -> Option<&EventWrapper<ChatEventInternal>> {
        let event_index = self.event_index_if_visible(event_key, min_visible_event_index)?;

        self.events_map.get(&event_index)
    }

    pub(crate) fn get_mut(
        &mut self,
        event_key: EventKey,
        min_visible_event_index: EventIndex,
    ) -> Option<&mut EventWrapper<ChatEventInternal>> {
        let event_index = self.event_index_if_visible(event_key, min_visible_event_index)?;

        self.events_map.get_mut(&event_index)
    }

    pub(crate) fn is_accessible(&self, event_key: EventKey, min_visible_event_index: EventIndex) -> bool {
        self.event_index_if_visible(event_key, min_visible_event_index).is_some()
    }

    pub(crate) fn iter(
        &self,
        start: Option<EventKey>,
        ascending: bool,
        min_visible_event_index: EventIndex,
    ) -> Box<dyn Iterator<Item = &EventWrapper<ChatEventInternal>> + '_> {
        let range = if let Some(start) = start {
            if let Some(event_index) = self.event_index_if_visible(start, min_visible_event_index) {
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

        let iter = range.map(|(_, e)| e);

        if ascending {
            Box::new(iter)
        } else {
            Box::new(iter.rev())
        }
    }

    pub(crate) fn event_count_since<F: Fn(&ChatEventInternal) -> bool>(&self, since: TimestampMillis, filter: &F) -> usize {
        self.events_map
            .values()
            .rev()
            .take_while(|e| e.timestamp > since)
            .filter(|e| filter(&e.event))
            .count()
    }

    pub fn latest_event_index(&self) -> Option<EventIndex> {
        self.latest_event_index
    }

    pub fn latest_message_index(&self) -> Option<MessageIndex> {
        self.latest_message_index
    }

    pub fn next_event_index(&self) -> EventIndex {
        self.latest_event_index.map_or(EventIndex::default(), |e| e.incr())
    }

    pub fn next_message_index(&self) -> MessageIndex {
        self.latest_message_index.map_or(MessageIndex::default(), |m| m.incr())
    }

    #[allow(clippy::too_many_arguments)]
    pub(crate) fn update_thread_summary(
        &mut self,
        thread_root_message_index: MessageIndex,
        user_id: UserId,
        latest_thread_message_index_if_updated: Option<MessageIndex>,
        latest_event_index: EventIndex,
        correlation_id: u64,
        disappears_at: Option<TimestampMillis>,
        now: TimestampMillis,
    ) {
        // If the current latest event is a `ThreadUpdated` event for the same thread then update
        // that existing event, else push a new event.
        let mut push_new_event = true;
        if let Some(latest_event) = self.events_map.values_mut().rev().next() {
            if let ChatEventInternal::ThreadUpdated(u) = &mut latest_event.event {
                if u.message_index == thread_root_message_index {
                    latest_event.timestamp = now;
                    if let Some(latest_message_index) = latest_thread_message_index_if_updated {
                        u.latest_thread_message_index_if_updated = Some(latest_message_index);
                    }
                    push_new_event = false;
                }
            }
        }

        if push_new_event {
            self.push_event(
                ChatEventInternal::ThreadUpdated(Box::new(ThreadUpdatedInternal {
                    message_index: thread_root_message_index,
                    latest_thread_message_index_if_updated,
                })),
                correlation_id,
                disappears_at,
                now,
            );
        }

        let root_message = self
            .event_index(thread_root_message_index.into())
            .and_then(|e| self.events_map.get_mut(&e))
            .and_then(|e| e.event.as_message_mut())
            .unwrap_or_else(|| panic!("Root thread message not found with message index {thread_root_message_index:?}"));

        root_message.last_updated = Some(now);

        let mut summary = root_message.thread_summary.get_or_insert_with(ThreadSummary::default);
        summary.latest_event_index = latest_event_index;
        summary.latest_event_timestamp = now;

        if latest_thread_message_index_if_updated.is_some() {
            summary.reply_count += 1;
            summary.participant_ids.push_if_not_contains(user_id);
        }
    }

    pub(crate) fn event_index_if_visible(
        &self,
        event_key: EventKey,
        min_visible_event_index: EventIndex,
    ) -> Option<EventIndex> {
        self.event_index(event_key).filter(|e| *e >= min_visible_event_index)
    }

    pub(crate) fn event_index(&self, event_key: EventKey) -> Option<EventIndex> {
        match event_key {
            EventKey::EventIndex(e) => Some(e),
            EventKey::MessageIndex(m) => self.message_index_map.get(&m).copied(),
            EventKey::MessageId(m) => self.message_id_map.get(&m).copied(),
        }
    }

    pub fn last(&self) -> &EventWrapper<ChatEventInternal> {
        self.events_map.values().rev().next().unwrap()
    }

    pub(crate) fn last_mut(&mut self) -> &mut EventWrapper<ChatEventInternal> {
        self.events_map.values_mut().rev().next().unwrap()
    }

    pub fn len(&self) -> usize {
        self.events_map.len()
    }

    pub fn is_empty(&self) -> bool {
        self.events_map.is_empty()
    }
}

pub struct ChatEventsListReader<'r> {
    events_list: &'r ChatEventsList,
    min_visible_event_index: EventIndex,
}

impl<'r> Deref for ChatEventsListReader<'r> {
    type Target = ChatEventsList;

    fn deref(&self) -> &Self::Target {
        self.events_list
    }
}

impl<'r> ChatEventsListReader<'r> {
    pub(crate) fn new(events_list: &ChatEventsList) -> ChatEventsListReader {
        Self::with_min_visible_event_index(events_list, EventIndex::default())
    }

    pub(crate) fn with_min_visible_event_index(
        events_list: &ChatEventsList,
        min_visible_event_index: EventIndex,
    ) -> ChatEventsListReader {
        ChatEventsListReader {
            events_list,
            min_visible_event_index,
        }
    }
}

pub trait Reader {
    fn get(&self, event_key: EventKey) -> Option<&EventWrapper<ChatEventInternal>>;
    fn event_index(&self, event_key: EventKey) -> Option<EventIndex>;
    fn iter(&self, start: Option<EventKey>, ascending: bool)
        -> Box<dyn Iterator<Item = &EventWrapper<ChatEventInternal>> + '_>;
    fn iter_latest_messages(&self, my_user_id: Option<UserId>) -> Box<dyn Iterator<Item = EventWrapper<Message>> + '_>;

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
                disappears_at: e.disappears_at,
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
        self.iter_latest_messages(my_user_id).next().filter(|m| m.timestamp > since)
    }

    fn affected_event_indexes_since(&self, since: TimestampMillis, max_results: usize) -> Vec<EventIndex> {
        let mut affected_events = HashSet::new();

        for EventWrapper { event, .. } in self.iter(None, false).take_while(|e| e.timestamp > since) {
            for index in self.affected_event_indexes(event) {
                if affected_events.insert(index) && affected_events.len() == max_results {
                    break;
                }
            }
        }

        affected_events.into_iter().collect()
    }

    fn affected_event_indexes(&self, event: &ChatEventInternal) -> Vec<EventIndex> {
        fn option_to_vec<T>(option: Option<T>) -> Vec<T> {
            option.map_or(vec![], |v| vec![v])
        }

        match event {
            ChatEventInternal::MessageEdited(m) => option_to_vec(self.event_index(m.message_id.into())),
            ChatEventInternal::MessageDeleted(m) => option_to_vec(self.event_index(m.message_id.into())),
            ChatEventInternal::MessageUndeleted(m) => option_to_vec(self.event_index(m.message_id.into())),
            ChatEventInternal::MessageReactionAdded(r) => option_to_vec(self.event_index(r.message_id.into())),
            ChatEventInternal::MessageReactionRemoved(r) => option_to_vec(self.event_index(r.message_id.into())),
            ChatEventInternal::PollVoteRegistered(v) => option_to_vec(self.event_index(v.message_id.into())),
            ChatEventInternal::PollVoteDeleted(v) => option_to_vec(self.event_index(v.message_id.into())),
            ChatEventInternal::PollEnded(p) => option_to_vec(self.event_index((**p).into())),
            ChatEventInternal::ThreadUpdated(u) => option_to_vec(self.event_index(u.message_index.into())),
            ChatEventInternal::ProposalsUpdated(p) => p
                .proposals
                .iter()
                .copied()
                .filter_map(|p| self.event_index(p.into()))
                .collect(),
            _ => vec![],
        }
    }

    fn affected_events(&self, events: &[EventWrapper<ChatEvent>], my_user_id: Option<UserId>) -> Vec<EventWrapper<ChatEvent>> {
        events
            .iter()
            .flat_map(|e| e.event.affected_events())
            .unique()
            .filter_map(|e| self.get(e.into()))
            .map(|e| self.hydrate_event(e, my_user_id))
            .collect()
    }

    fn hydrate_event(&self, event: &EventWrapper<ChatEventInternal>, my_user_id: Option<UserId>) -> EventWrapper<ChatEvent> {
        let event_data = match &event.event {
            ChatEventInternal::DirectChatCreated(d) => ChatEvent::DirectChatCreated(*d),
            ChatEventInternal::Message(m) => ChatEvent::Message(Box::new(m.hydrate(my_user_id))),
            ChatEventInternal::MessageEdited(m) => ChatEvent::MessageEdited(self.hydrate_updated_message(m)),
            ChatEventInternal::MessageDeleted(m) => ChatEvent::MessageDeleted(self.hydrate_updated_message(m)),
            ChatEventInternal::MessageUndeleted(m) => ChatEvent::MessageUndeleted(self.hydrate_updated_message(m)),
            ChatEventInternal::MessageReactionAdded(m) => ChatEvent::MessageReactionAdded(self.hydrate_updated_message(m)),
            ChatEventInternal::MessageReactionRemoved(m) => ChatEvent::MessageReactionRemoved(self.hydrate_updated_message(m)),
            ChatEventInternal::GroupChatCreated(g) => ChatEvent::GroupChatCreated(*g.clone()),
            ChatEventInternal::GroupNameChanged(g) => ChatEvent::GroupNameChanged(*g.clone()),
            ChatEventInternal::GroupDescriptionChanged(g) => ChatEvent::GroupDescriptionChanged(*g.clone()),
            ChatEventInternal::GroupRulesChanged(g) => ChatEvent::GroupRulesChanged(*g.clone()),
            ChatEventInternal::AvatarChanged(g) => ChatEvent::AvatarChanged(*g.clone()),
            ChatEventInternal::OwnershipTransferred(e) => ChatEvent::OwnershipTransferred(*e.clone()),
            ChatEventInternal::ParticipantsAdded(p) => ChatEvent::ParticipantsAdded(*p.clone()),
            ChatEventInternal::ParticipantsRemoved(p) => ChatEvent::ParticipantsRemoved(*p.clone()),
            ChatEventInternal::ParticipantJoined(p) => ChatEvent::ParticipantJoined(*p.clone()),
            ChatEventInternal::ParticipantLeft(p) => ChatEvent::ParticipantLeft(*p.clone()),
            ChatEventInternal::ParticipantAssumesSuperAdmin(p) => ChatEvent::ParticipantAssumesSuperAdmin(*p.clone()),
            ChatEventInternal::ParticipantRelinquishesSuperAdmin(p) => ChatEvent::ParticipantRelinquishesSuperAdmin(*p.clone()),
            ChatEventInternal::ParticipantDismissedAsSuperAdmin(p) => ChatEvent::ParticipantDismissedAsSuperAdmin(*p.clone()),
            ChatEventInternal::RoleChanged(r) => ChatEvent::RoleChanged(*r.clone()),
            ChatEventInternal::UsersBlocked(u) => ChatEvent::UsersBlocked(*u.clone()),
            ChatEventInternal::UsersUnblocked(u) => ChatEvent::UsersUnblocked(*u.clone()),
            ChatEventInternal::MessagePinned(p) => ChatEvent::MessagePinned(*p.clone()),
            ChatEventInternal::PermissionsChanged(p) => ChatEvent::PermissionsChanged(*p.clone()),
            ChatEventInternal::MessageUnpinned(u) => ChatEvent::MessageUnpinned(*u.clone()),
            ChatEventInternal::PollVoteRegistered(v) => ChatEvent::PollVoteRegistered(self.hydrate_poll_vote_registered(v)),
            ChatEventInternal::PollVoteDeleted(v) => ChatEvent::PollVoteDeleted(self.hydrate_updated_message(v)),
            ChatEventInternal::PollEnded(m) => ChatEvent::PollEnded(self.hydrate_poll_ended(**m)),
            ChatEventInternal::ThreadUpdated(m) => {
                ChatEvent::ThreadUpdated(self.hydrate_thread_updated(m.message_index, m.latest_thread_message_index_if_updated))
            }
            ChatEventInternal::ProposalsUpdated(p) => ChatEvent::ProposalsUpdated(self.hydrate_proposals_updated(p)),
            ChatEventInternal::GroupVisibilityChanged(g) => ChatEvent::GroupVisibilityChanged(*g.clone()),
            ChatEventInternal::GroupInviteCodeChanged(g) => ChatEvent::GroupInviteCodeChanged(*g.clone()),
            ChatEventInternal::ChatFrozen(f) => ChatEvent::ChatFrozen(*f.clone()),
            ChatEventInternal::ChatUnfrozen(u) => ChatEvent::ChatUnfrozen(*u.clone()),
        };

        EventWrapper {
            index: event.index,
            timestamp: event.timestamp,
            correlation_id: event.correlation_id,
            disappears_at: event.disappears_at,
            event: event_data,
        }
    }

    fn hydrate_mention(&self, mention: &MentionInternal) -> Option<Mention> {
        self.message_event_internal(mention.message_index.into()).map(|e| Mention {
            thread_root_message_index: mention.thread_root_message_index,
            message_id: e.event.message_id,
            message_index: e.event.message_index,
            event_index: e.index,
            mentioned_by: e.event.sender,
        })
    }

    fn hydrate_updated_message(&self, message: &UpdatedMessageInternal) -> UpdatedMessage {
        UpdatedMessage {
            updated_by: message.updated_by,
            event_index: self.event_index(message.message_id.into()).unwrap_or_default(),
            message_id: message.message_id,
        }
    }

    fn hydrate_poll_vote_registered(&self, poll_vote_registered: &PollVoteRegistered) -> UpdatedMessage {
        UpdatedMessage {
            updated_by: poll_vote_registered.user_id,
            event_index: self.event_index(poll_vote_registered.message_id.into()).unwrap_or_default(),
            message_id: poll_vote_registered.message_id,
        }
    }

    fn hydrate_poll_ended(&self, message_index: MessageIndex) -> PollEnded {
        let event_index = self.event_index(message_index.into()).unwrap_or_default();

        PollEnded {
            message_index,
            event_index,
        }
    }

    fn hydrate_thread_updated(
        &self,
        message_index: MessageIndex,
        latest_thread_message_index_if_updated: Option<MessageIndex>,
    ) -> ThreadUpdated {
        let event_index = self.event_index(message_index.into()).unwrap_or_default();

        ThreadUpdated {
            message_index,
            event_index,
            latest_thread_message_index_if_updated,
        }
    }

    fn hydrate_proposals_updated(&self, updates: &ProposalsUpdatedInternal) -> ProposalsUpdated {
        let proposals = updates
            .proposals
            .iter()
            .map(|&message_index| {
                let event_index = self.event_index(message_index.into()).unwrap_or_default();

                ProposalUpdated {
                    event_index,
                    message_index,
                }
            })
            .collect();

        ProposalsUpdated { proposals }
    }

    fn cap_then_hydrate_events<'a>(
        &self,
        iterator: impl Iterator<Item = &'a EventWrapper<ChatEventInternal>>,
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
    fn get(&self, event_key: EventKey) -> Option<&EventWrapper<ChatEventInternal>> {
        self.events_list.get(event_key, self.min_visible_event_index)
    }

    fn event_index(&self, event_key: EventKey) -> Option<EventIndex> {
        self.events_list
            .event_index_if_visible(event_key, self.min_visible_event_index)
    }

    fn iter(
        &self,
        start: Option<EventKey>,
        ascending: bool,
    ) -> Box<dyn Iterator<Item = &EventWrapper<ChatEventInternal>> + '_> {
        self.events_list.iter(start, ascending, self.min_visible_event_index)
    }

    fn iter_latest_messages(&self, my_user_id: Option<UserId>) -> Box<dyn Iterator<Item = EventWrapper<Message>> + '_> {
        Box::new(
            self.events_list
                .message_index_map
                .values()
                .copied()
                .rev()
                .map_while(|e| self.events_list.get(e.into(), self.min_visible_event_index))
                .filter_map(move |e| try_into_message_event(e, my_user_id)),
        )
    }
}

fn try_into_message_event(
    event: &EventWrapper<ChatEventInternal>,
    my_user_id: Option<UserId>,
) -> Option<EventWrapper<Message>> {
    let message = event.event.as_message()?;

    Some(EventWrapper {
        index: event.index,
        timestamp: event.timestamp,
        correlation_id: event.correlation_id,
        disappears_at: event.disappears_at,
        event: message.hydrate(my_user_id),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{ChatEvents, PushMessageArgs};
    use candid::Principal;
    use std::mem::size_of;
    use types::{MessageContentInternal, TextContent};

    #[test]
    fn enum_size() {
        let size = size_of::<ChatEventInternal>();
        assert_eq!(size, 16);
    }

    #[test]
    fn scan_ascending_from_start() {
        let events = setup_events();
        let events_reader = events.main_events_reader();

        let results = events_reader.scan(None, true, usize::MAX, usize::MAX, None);

        let event_indexes: Vec<usize> = results.iter().map(|e| e.index.into()).collect();

        assert_eq!(event_indexes, (0..events_reader.len()).collect_vec());
    }

    #[test]
    fn scan_descending_from_end() {
        let events = setup_events();
        let events_reader = events.main_events_reader();

        let results = events_reader.scan(None, false, usize::MAX, usize::MAX, None);

        let event_indexes: Vec<usize> = results.iter().map(|e| e.index.into()).collect();

        assert_eq!(event_indexes, (0..events_reader.len()).rev().collect_vec());
    }

    #[test]
    fn scan_ascending() {
        let events = setup_events();
        let events_reader = events.main_events_reader();

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
        let events = setup_events();
        let events_reader = events.main_events_reader();

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
    fn window_message_limit() {
        let events = setup_events();
        let events_reader = events.main_events_reader();

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
        let events = setup_events();
        let events_reader = events.main_events_reader();

        let start = 40.into();

        let results = events_reader.window(EventKey::EventIndex(start), usize::MAX, 15, None);

        let event_indexes: Vec<_> = results.into_iter().map(|e| e.index).collect();

        assert_eq!(event_indexes, (33..=47).map(|i| i.into()).collect_vec());
    }

    #[test]
    fn window_min_visible_event_index() {
        let events = setup_events();
        let events_reader = events.visible_main_events_reader(46.into());

        let start = 50.into();

        let results = events_reader.window(EventKey::EventIndex(start), usize::MAX, 25, None);

        let event_indexes: Vec<_> = results.into_iter().map(|e| e.index).collect();

        assert_eq!(event_indexes, (46..=70).map(|i| i.into()).collect_vec());
    }

    fn setup_events() -> ChatEvents {
        let user_id = Principal::from_slice(&[1]).into();

        let mut events = ChatEvents::new_direct_chat(Principal::from_slice(&[2]).into(), 1);

        for i in 2..50 {
            let message_id = i.into();
            events.push_message(PushMessageArgs {
                sender: user_id,
                thread_root_message_index: None,
                message_id,
                content: MessageContentInternal::Text(TextContent {
                    text: "hello".to_owned(),
                }),
                replies_to: None,
                now: i as u64,
                forwarded: false,
                correlation_id: 0,
            });
            events.push_main_event(
                ChatEventInternal::MessageReactionAdded(Box::new(UpdatedMessageInternal {
                    updated_by: user_id,
                    message_id,
                })),
                0,
                i as u64,
            );
        }

        events
    }
}
