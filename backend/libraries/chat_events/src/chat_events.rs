use crate::types::{ChatEventInternal, MessageInternal, UpdatedMessageInternal};
use crate::{ProposalsUpdatedInternal, ThreadUpdatedInternal};
use candid::CandidType;
use itertools::Itertools;
use search::*;
use serde::{Deserialize, Serialize};
use std::cmp::{max, min, Reverse};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::{btree_map, BTreeMap, HashMap, HashSet, VecDeque};
use std::iter::FromIterator;
use std::ops::{Bound, Range, RangeBounds, RangeInclusive};
use types::*;

#[derive(Serialize, Deserialize)]
pub struct ChatEvents {
    chat_id: ChatId,
    main: ChatEvents,
    threads: HashMap<MessageIndex, ChatEvents>,
    metrics: ChatMetrics,
    per_user_metrics: HashMap<UserId, ChatMetrics>,
    frozen: bool,
}

impl ChatEvents {
    pub fn update_thread_summary(
        &mut self,
        thread_root_message_index: MessageIndex,
        user_id: UserId,
        latest_thread_message_index_if_updated: Option<MessageIndex>,
        correlation_id: u64,
        now: TimestampMillis,
    ) {
        if let Some(thread_events) = self.threads.get(&thread_root_message_index) {
            self.main.update_thread_summary(
                thread_root_message_index,
                user_id,
                latest_thread_message_index_if_updated,
                thread_events.last().index,
                correlation_id,
                now,
            );
        }
    }

    pub fn update_proposals(
        &mut self,
        user_id: UserId,
        updates: Vec<(MessageId, ProposalStatusUpdate)>,
        correlation_id: u64,
        now: TimestampMillis,
    ) {
        let mut message_indexes = Vec::new();

        let chat_events = &mut self.main;

        for (message_id, update) in updates {
            if let Some(message) = chat_events
                .message_internal_mut_by_message_id(message_id)
                .filter(|m| m.sender == user_id)
            {
                if let MessageContentInternal::GovernanceProposal(p) = &mut message.content {
                    p.proposal.update_status(update, now);
                    message_indexes.push(message.message_index);
                }
            }
        }
        if !message_indexes.is_empty() {
            message_indexes.sort_unstable();

            let mut push_new_event = true;
            if let Some(mut last_event) = chat_events.events.iter_mut().rev().next() {
                if let ChatEventInternal::ProposalsUpdated(p) = &last_event.event {
                    if p.proposals == message_indexes {
                        last_event.timestamp = now;
                        push_new_event = false;
                    }
                }
            }

            // Active proposals are updated roughly every minute, so in order to avoid adding
            // thousands of duplicate events, we first check if the current last event matches the
            // event being added, and if so we simply bump the timestamp of the existing event, else
            // we add a new event.
            if push_new_event {
                self.push_event(
                    None,
                    ChatEventInternal::ProposalsUpdated(Box::new(ProposalsUpdatedInternal {
                        proposals: message_indexes,
                    })),
                    correlation_id,
                    now,
                );
            }
        }
    }

    pub fn push_main_event(&mut self, event: ChatEventInternal, correlation_id: u64, now: TimestampMillis) -> EventIndex {
        self.push_event(None, event, correlation_id, now)
    }

    pub fn metrics(&self) -> &ChatMetrics {
        &self.metrics
    }

    pub fn event_count_since<F: Fn(&ChatEventInternal) -> bool>(&self, since: TimestampMillis, filter: F) -> usize {
        self.main.event_count_since(since, &filter)
            + self
                .threads
                .values()
                .map(|e| e.event_count_since(since, &filter))
                .sum::<usize>()
    }

    pub fn user_metrics(&self, user_id: &UserId, if_updated_since: Option<TimestampMillis>) -> Option<&ChatMetrics> {
        self.per_user_metrics
            .get(user_id)
            .filter(|m| if let Some(since) = if_updated_since { m.last_active > since } else { true })
    }

    pub fn is_message_accessible_by_id(
        &self,
        min_visible_event_index: EventIndex,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
    ) -> bool {
        thread_root_message_index
            .or_else(|| self.main.message_internal_by_message_id(message_id).map(|m| m.message_index))
            .map_or(false, |message_index| {
                self.is_message_accessible(min_visible_event_index, message_index)
            })
    }

    pub fn is_message_accessible_by_index(
        &self,
        min_visible_event_index: EventIndex,
        thread_root_message_index: Option<MessageIndex>,
        message_index: MessageIndex,
    ) -> bool {
        self.is_message_accessible(min_visible_event_index, thread_root_message_index.unwrap_or(message_index))
    }

    pub fn are_messages_accessible(
        &self,
        min_visible_event_index: EventIndex,
        thread_root_message_index: Option<MessageIndex>,
        message_ids: &[MessageId],
    ) -> bool {
        if let Some(root_message_index) = thread_root_message_index {
            self.is_message_accessible(min_visible_event_index, root_message_index)
        } else {
            message_ids.iter().all(|id| {
                self.main
                    .event_index_by_message_id(*id)
                    .map_or(false, |event_index| event_index >= min_visible_event_index)
            })
        }
    }

    pub fn get_with_min_visible_event_index(
        &self,
        thread_root_message_index: Option<MessageIndex>,
        min_visible_event_index: EventIndex,
    ) -> Option<(&ChatEvents, EventIndex)> {
        if let Some(root_message_index) = thread_root_message_index {
            self.main
                .event_index_by_message_index(root_message_index)
                .filter(|thread_event_index| *thread_event_index >= min_visible_event_index)
                .and_then(|_| self.threads.get(&root_message_index))
                .map(|events| (events, EventIndex::default()))
        } else {
            Some((&self.main, min_visible_event_index))
        }
    }

    pub fn main(&self) -> &ChatEvents {
        &self.main
    }

    pub fn latest_threads(
        &self,
        from_set: &HashSet<MessageIndex>,
        updated_since: Option<TimestampMillis>,
        max_threads: usize,
    ) -> Vec<GroupCanisterThreadDetails> {
        from_set
            .iter()
            .filter_map(|root_message_index| {
                self.threads.get(root_message_index).and_then(|thread_events| {
                    let latest_event = thread_events.last();
                    updated_since
                        .map_or(true, |since| latest_event.timestamp > since)
                        .then_some(GroupCanisterThreadDetails {
                            root_message_index: *root_message_index,
                            latest_event: latest_event.index,
                            latest_message: thread_events.latest_message_index().unwrap_or_default(),
                            last_updated: latest_event.timestamp,
                        })
                })
            })
            .sorted_unstable_by_key(|t| Reverse(t.last_updated))
            .take(max_threads)
            .collect()
    }

    pub fn get(&self, thread_root_message_index: Option<MessageIndex>) -> Option<&ChatEvents> {
        if let Some(root_message_index) = thread_root_message_index {
            self.threads.get(&root_message_index)
        } else {
            Some(&self.main)
        }
    }

    pub fn freeze(&mut self, user_id: UserId, reason: Option<String>, now: TimestampMillis) -> EventIndex {
        let event_index = self.push_event(
            None,
            ChatEventInternal::ChatFrozen(Box::new(ChatFrozen {
                frozen_by: user_id,
                reason,
            })),
            0,
            now,
        );
        self.frozen = true;
        event_index
    }

    pub fn unfreeze(&mut self, user_id: UserId, now: TimestampMillis) -> EventIndex {
        self.frozen = false;
        self.push_event(
            None,
            ChatEventInternal::ChatUnfrozen(Box::new(ChatUnfrozen { unfrozen_by: user_id })),
            0,
            now,
        )
    }

    // Note: this method assumes that if there is some thread_root_message_index then the thread exists
    fn push_event(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        event: ChatEventInternal,
        correlation_id: u64,
        now: TimestampMillis,
    ) -> EventIndex {
        if self.frozen {
            // We should never hit this because if the chat is frozen it should be handled earlier,
            // this is just here as a safety net.
            panic!("This chat is frozen");
        }

        self.add_to_metrics(&event, thread_root_message_index, now);

        let event_index = self
            .get_mut(thread_root_message_index)
            .unwrap()
            .push_event(event, correlation_id, now);

        event_index
    }

    fn get_mut(&mut self, thread_root_message_index: Option<MessageIndex>) -> Option<&mut ChatEvents> {
        if let Some(root_message_index) = thread_root_message_index {
            self.threads.get_mut(&root_message_index)
        } else {
            Some(&mut self.main)
        }
    }

    fn add_to_metrics(
        &mut self,
        event: &ChatEventInternal,
        thread_root_message_index: Option<MessageIndex>,
        now: TimestampMillis,
    ) {
        let deleted_message_sender = match event {
            ChatEventInternal::MessageDeleted(m) | ChatEventInternal::MessageUndeleted(m) => self
                .get(thread_root_message_index)
                .and_then(|e| e.message_internal_by_message_id(m.message_id))
                .map(|m| m.sender),
            _ => None,
        };

        event.add_to_metrics(&mut self.metrics, &mut self.per_user_metrics, deleted_message_sender, now);
    }

    fn is_message_accessible(&self, min_visible_event_index: EventIndex, message_index: MessageIndex) -> bool {
        self.main
            .event_index_by_message_index(message_index)
            .map_or(false, |event_index| event_index >= min_visible_event_index)
    }

    fn message_internal_mut_by_message_index(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        message_index: MessageIndex,
    ) -> Option<&mut MessageInternal> {
        self.get_mut(thread_root_message_index)
            .and_then(|chat_events| chat_events.message_internal_mut_by_message_index(message_index))
    }

    fn message_internal_mut_by_message_id(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
    ) -> Option<&mut MessageInternal> {
        self.get_mut(thread_root_message_index)
            .and_then(|chat_events| chat_events.message_internal_mut_by_message_id(message_id))
    }
}

#[derive(Serialize, Deserialize)]
pub struct ChatEvents {
    chat_id: ChatId,
    thread_root_message_index: Option<MessageIndex>,
    events_type: ChatEventsType,
    events: ChatEventsMap,
    message_id_map: HashMap<MessageId, EventIndex>,
    message_index_map: BTreeMap<MessageIndex, EventIndex>,
    #[serde(default)]
    latest_event_index: Option<EventIndex>,
}

#[derive(CandidType, Serialize, Deserialize)]
enum ChatEventsType {
    Direct,
    Group,
    Thread,
}

impl ChatEvents {
    pub fn new_thread(chat_id: ChatId, thread_root_message_index: MessageIndex) -> ChatEvents {
        ChatEvents {
            chat_id,
            thread_root_message_index: Some(thread_root_message_index),
            events_type: ChatEventsType::Thread,
            events: ChatEventsMap::default(),
            message_id_map: HashMap::new(),
            message_index_map: BTreeMap::new(),
            latest_event_index: None,
        }
    }

    pub fn get(&self, event_index: EventIndex) -> Option<&EventWrapper<ChatEventInternal>> {
        self.events.get(&event_index)
    }

    pub fn get_mut(&mut self, event_index: EventIndex) -> Option<&mut EventWrapper<ChatEventInternal>> {
        self.events.get_mut(&event_index)
    }

    pub fn hydrate_message_event_internal(
        &self,
        message_event: EventWrapper<&MessageInternal>,
        my_user_id: Option<UserId>,
    ) -> EventWrapper<Message> {
        EventWrapper {
            index: message_event.index,
            timestamp: message_event.timestamp,
            correlation_id: message_event.correlation_id,
            event: self.hydrate_message(message_event.event, my_user_id),
        }
    }

    pub fn event_count_since<F: Fn(&ChatEventInternal) -> bool>(&self, since: TimestampMillis, filter: &F) -> usize {
        self.events
            .iter()
            .rev()
            .take_while(|e| e.timestamp > since)
            .filter(|e| filter(&e.event))
            .count()
    }

    fn update_thread_summary(
        &mut self,
        thread_root_message_index: MessageIndex,
        user_id: UserId,
        latest_thread_message_index_if_updated: Option<MessageIndex>,
        latest_event_index: EventIndex,
        correlation_id: u64,
        now: TimestampMillis,
    ) {
        // If the current latest event is a `ThreadUpdated` event for the same thread then update
        // that existing event, else push a new event.
        let mut push_new_event = true;
        {
            if let Some(latest_event) = self.events.iter_mut().rev().next() {
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
        };

        if push_new_event {
            self.push_event(
                ChatEventInternal::ThreadUpdated(Box::new(ThreadUpdatedInternal {
                    message_index: thread_root_message_index,
                    latest_thread_message_index_if_updated,
                })),
                correlation_id,
                now,
            );
        }

        let root_message = self
            .event_index_by_message_index(thread_root_message_index)
            .and_then(|e| self.events.get_mut(&e))
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

    fn push_event(&mut self, event: ChatEventInternal, correlation_id: u64, now: TimestampMillis) -> EventIndex {
        let valid = match self.events_type {
            ChatEventsType::Direct => event.is_valid_for_direct_chat(),
            ChatEventsType::Group => event.is_valid_for_group_chat(),
            ChatEventsType::Thread => event.is_valid_for_thread(),
        };

        if !valid {
            panic!("Event type is not valid: {event:?}");
        }

        let event_index = self.events.next_event_index();
        if let ChatEventInternal::Message(m) = &event {
            match self.message_id_map.entry(m.message_id) {
                Vacant(e) => e.insert(event_index),
                _ => panic!("MessageId already used: {:?}", m.message_id),
            };
            self.message_index_map.insert(m.message_index, event_index);
        }

        self.events.push(EventWrapper {
            index: event_index,
            timestamp: now,
            correlation_id,
            event,
        });

        event_index
    }

    pub fn latest_message(&self, my_user_id: Option<UserId>) -> Option<EventWrapper<Message>> {
        self.latest_message_if_updated(0, my_user_id)
    }

    pub fn latest_message_if_updated(
        &self,
        since: TimestampMillis,
        my_user_id: Option<UserId>,
    ) -> Option<EventWrapper<Message>> {
        let event_index = self.latest_message_event_index()?;
        let event = self.get(event_index)?;
        let message = event.event.as_message()?;

        if max(event.timestamp, message.last_updated.unwrap_or(0)) > since {
            Some(EventWrapper {
                index: event.index,
                timestamp: event.timestamp,
                correlation_id: event.correlation_id,
                event: self.hydrate_message(message, my_user_id),
            })
        } else {
            None
        }
    }

    pub fn last(&self) -> &EventWrapper<ChatEventInternal> {
        self.events.iter().rev().next().unwrap()
    }

    pub fn latest_message_index(&self) -> Option<MessageIndex> {
        self.message_index_map.keys().last().copied()
    }

    pub fn latest_message_event_index(&self) -> Option<EventIndex> {
        self.message_index_map.values().last().copied()
    }

    pub fn next_message_index(&self) -> MessageIndex {
        self.latest_message_index().map_or(MessageIndex::default(), |m| m.incr())
    }

    pub fn iter(&self) -> impl DoubleEndedIterator<Item = &EventWrapper<ChatEventInternal>> {
        self.events.iter()
    }

    pub fn since(&self, event_index: EventIndex) -> impl DoubleEndedIterator<Item = &EventWrapper<ChatEventInternal>> {
        self.events.since(event_index, EventIndex::default())
    }

    pub fn hydrate_message(&self, message: &MessageInternal, my_user_id: Option<UserId>) -> Message {
        Message {
            message_index: message.message_index,
            message_id: message.message_id,
            sender: message.sender,
            content: if let Some(deleted_by) = message.deleted_by.clone() {
                MessageContent::Deleted(deleted_by)
            } else {
                message.content.hydrate(my_user_id)
            },
            replies_to: message.replies_to.clone(),
            reactions: message
                .reactions
                .iter()
                .map(|(r, u)| (r.clone(), u.iter().copied().collect()))
                .collect(),
            edited: message.last_edited.is_some(),
            forwarded: message.forwarded,
            thread_summary: message.thread_summary.clone(),
            last_updated: message.last_updated,
        }
    }

    pub fn hydrate_updated_message(&self, message: &UpdatedMessageInternal) -> UpdatedMessage {
        UpdatedMessage {
            updated_by: message.updated_by,
            event_index: self.event_index_by_message_id(message.message_id).unwrap_or_default(),
            message_id: message.message_id,
        }
    }

    pub fn hydrate_poll_vote_registered(&self, poll_vote_registered: &PollVoteRegistered) -> UpdatedMessage {
        UpdatedMessage {
            updated_by: poll_vote_registered.user_id,
            event_index: self
                .event_index_by_message_id(poll_vote_registered.message_id)
                .unwrap_or_default(),
            message_id: poll_vote_registered.message_id,
        }
    }

    pub fn hydrate_poll_ended(&self, message_index: MessageIndex) -> PollEnded {
        let event_index = self.message_index_map.get(&message_index).copied().unwrap_or_default();

        PollEnded {
            message_index,
            event_index,
        }
    }

    pub fn hydrate_thread_updated(
        &self,
        message_index: MessageIndex,
        latest_thread_message_index_if_updated: Option<MessageIndex>,
    ) -> ThreadUpdated {
        let event_index = self.message_index_map.get(&message_index).copied().unwrap_or_default();

        ThreadUpdated {
            message_index,
            event_index,
            latest_thread_message_index_if_updated,
        }
    }

    pub fn hydrate_proposals_updated(&self, updates: &ProposalsUpdatedInternal) -> ProposalsUpdated {
        let proposals = updates
            .proposals
            .iter()
            .map(|&message_index| {
                let event_index = self.message_index_map.get(&message_index).copied().unwrap_or_default();

                ProposalUpdated {
                    event_index,
                    message_index,
                }
            })
            .collect();

        ProposalsUpdated { proposals }
    }

    pub fn range(
        &self,
        from_event_index: EventIndex,
        to_event_index: EventIndex,
        my_user_id: Option<UserId>,
    ) -> Vec<EventWrapper<ChatEvent>> {
        self.events
            .range(from_event_index..=to_event_index)
            .map(|e| self.hydrate_event(e, my_user_id))
            .collect()
    }

    pub fn get_by_index(&self, indexes: Vec<EventIndex>, my_user_id: Option<UserId>) -> Vec<EventWrapper<ChatEvent>> {
        self.events
            .get_by_index(&indexes)
            .iter()
            .map(|e| self.hydrate_event(e, my_user_id))
            .collect()
    }

    pub fn from_index(
        &self,
        start: EventIndex,
        ascending: bool,
        max_messages: usize,
        max_events: usize,
        min_visible_event_index: EventIndex,
        my_user_id: Option<UserId>,
    ) -> Vec<EventWrapper<ChatEvent>> {
        self.events
            .from_index(start, ascending, max_messages, max_events, min_visible_event_index)
            .into_iter()
            .map(|e| self.hydrate_event(e, my_user_id))
            .collect()
    }

    pub fn get_events_window(
        &self,
        mid_point: EventIndex,
        max_messages: usize,
        max_events: usize,
        min_visible_event_index: EventIndex,
        my_user_id: Option<UserId>,
    ) -> Vec<EventWrapper<ChatEvent>> {
        self.events
            .get_window(mid_point, max_messages, max_events, min_visible_event_index)
            .into_iter()
            .map(|e| self.hydrate_event(e, my_user_id))
            .collect()
    }

    pub fn affected_events(
        &self,
        events: &[EventWrapper<ChatEvent>],
        my_user_id: Option<UserId>,
    ) -> Vec<EventWrapper<ChatEvent>> {
        // We use this set to exclude events that are already in the input list
        let event_indexes_set: HashSet<_> = events.iter().map(|e| e.index).collect();

        let affected_event_indexes = events
            .iter()
            .flat_map(|e| e.event.affected_events())
            .filter(|e| !event_indexes_set.contains(e))
            .unique()
            .collect();

        self.get_by_index(affected_event_indexes, my_user_id)
    }

    pub fn latest_messages(&self, message_count: u32, my_user_id: Option<UserId>) -> Vec<EventWrapper<Message>> {
        self.message_index_map
            .values()
            .rev()
            .filter_map(|event_index| self.events.get(event_index))
            .filter_map(|e| {
                if let ChatEventInternal::Message(message) = &e.event {
                    Some(EventWrapper {
                        index: e.index,
                        timestamp: e.timestamp,
                        correlation_id: e.correlation_id,
                        event: self.hydrate_message(message, my_user_id),
                    })
                } else {
                    None
                }
            })
            .take(message_count as usize)
            .collect()
    }

    fn hydrate_event(&self, event: &EventWrapper<ChatEventInternal>, my_user_id: Option<UserId>) -> EventWrapper<ChatEvent> {
        let event_data = match &event.event {
            ChatEventInternal::DirectChatCreated(d) => ChatEvent::DirectChatCreated(*d),
            ChatEventInternal::Message(m) => ChatEvent::Message(Box::new(self.hydrate_message(m, my_user_id))),
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
            event: event_data,
        }
    }
}

#[derive(Serialize, Deserialize, Default)]
#[serde(from = "ChatEventsVec")]
struct ChatEventsMap {
    events: BTreeMap<EventIndex, EventWrapper<ChatEventInternal>>,
}

#[derive(Serialize, Deserialize, Default)]
struct ChatEventsVec {
    events: Vec<EventWrapper<ChatEventInternal>>,
}

impl From<ChatEventsVec> for ChatEventsMap {
    fn from(value: ChatEventsVec) -> Self {
        ChatEventsMap {
            events: value.events.into_iter().map(|e| (e.index, e)).collect(),
        }
    }
}

impl ChatEventsMap {
    pub fn push(&mut self, event: EventWrapper<ChatEventInternal>) {
        match self.events.entry(event.index) {
            btree_map::Entry::Vacant(e) => e.insert(event),
            _ => panic!("Event already exists with event index {}", event.index),
        };
    }

    pub fn get(&self, event_index: &EventIndex) -> Option<&EventWrapper<ChatEventInternal>> {
        self.events.get(event_index)
    }

    pub fn get_mut(&mut self, event_index: &EventIndex) -> Option<&mut EventWrapper<ChatEventInternal>> {
        self.events.get_mut(event_index)
    }

    pub fn since(
        &self,
        event_index: EventIndex,
        min_visible_event_index: EventIndex,
    ) -> impl DoubleEndedIterator<Item = &EventWrapper<ChatEventInternal>> {
        self.events_range_safe(event_index.., min_visible_event_index)
    }

    pub fn range(
        &self,
        range: RangeInclusive<EventIndex>,
    ) -> impl DoubleEndedIterator<Item = &EventWrapper<ChatEventInternal>> {
        self.events_range_safe(*range.start()..=*range.end(), EventIndex::default())
    }

    pub fn get_by_index(&self, indexes: &[EventIndex]) -> Vec<&EventWrapper<ChatEventInternal>> {
        indexes.iter().filter_map(|i| self.get(i)).collect()
    }

    #[allow(clippy::wrong_self_convention)]
    pub fn from_index(
        &self,
        start: EventIndex,
        ascending: bool,
        max_messages: usize,
        max_events: usize,
        min_visible_event_index: EventIndex,
    ) -> Vec<&EventWrapper<ChatEventInternal>> {
        let iter: Box<dyn Iterator<Item = &EventWrapper<ChatEventInternal>>> = if ascending {
            let range = self.events_range_safe(start.., min_visible_event_index);
            Box::new(range)
        } else {
            let range = self.events_range_safe(..=start, min_visible_event_index);
            Box::new(range.rev())
        };

        let mut events = Vec::new();
        let mut message_count = 0;
        for event in iter.take(max_events) {
            let is_message = matches!(event.event, ChatEventInternal::Message(_));
            events.push(event);

            if is_message {
                message_count += 1;
                if message_count == max_messages {
                    break;
                }
            }
        }
        if !ascending {
            events.reverse();
        }
        events
    }

    pub fn get_window(
        &self,
        mid_point: EventIndex,
        max_messages: usize,
        max_events: usize,
        min_visible_event_index: EventIndex,
    ) -> Vec<&EventWrapper<ChatEventInternal>> {
        let mut forwards_iter = self.events_range_safe(mid_point.., min_visible_event_index);
        let mut backwards_iter = self.events_range_safe(..mid_point, min_visible_event_index).rev();

        let mut events = VecDeque::new();
        let mut message_count = 0;
        let mut max_reached = false;
        let mut min_reached = false;

        let mut iter_forwards = true;

        // Alternates between iterating forwards and backwards (unless either end is
        // reached) adding one event each time until the message limit is reached, the
        // event limit is reached, or there are no more events available.
        loop {
            if events.len() == max_events || (min_reached && max_reached) {
                break;
            }

            let mut message_added = false;
            if iter_forwards {
                if let Some(next) = forwards_iter.next() {
                    message_added = matches!(next.event, ChatEventInternal::Message(_));
                    events.push_back(next);
                } else {
                    max_reached = true;
                }
                if !min_reached {
                    iter_forwards = false;
                }
            } else {
                if let Some(previous) = backwards_iter.next() {
                    message_added = matches!(previous.event, ChatEventInternal::Message(_));
                    events.push_front(previous);
                } else {
                    min_reached = true;
                }
                if !max_reached {
                    iter_forwards = true;
                }
            }
            if message_added {
                message_count += 1;
                if message_count == max_messages {
                    break;
                }
            }
        }

        Vec::from_iter(events)
    }

    pub fn next_event_index(&self) -> EventIndex {
        self.events
            .keys()
            .rev()
            .next()
            .copied()
            .map_or(EventIndex::default(), |i| i.incr())
    }

    pub fn is_empty(&self) -> bool {
        self.events.is_empty()
    }

    pub fn len(&self) -> usize {
        self.events.len()
    }

    pub fn iter(&self) -> impl DoubleEndedIterator<Item = &EventWrapper<ChatEventInternal>> {
        self.events.values()
    }

    pub fn iter_mut(&mut self) -> impl DoubleEndedIterator<Item = &mut EventWrapper<ChatEventInternal>> {
        self.events.values_mut()
    }

    fn events_range_safe(
        &self,
        range: impl RangeBounds<EventIndex>,
        min_visible_index: EventIndex,
    ) -> impl DoubleEndedIterator<Item = &EventWrapper<ChatEventInternal>> {
        let start = match range.start_bound().cloned() {
            Bound::Included(s) => max(s, min_visible_index),
            Bound::Excluded(s) => max(s.decr(), min_visible_index),
            Bound::Unbounded => min_visible_index,
        };

        let max = self.next_event_index();
        let end = match range.end_bound().cloned() {
            Bound::Included(e) => min(e.incr(), max),
            Bound::Excluded(e) => min(e, max),
            Bound::Unbounded => max,
        };

        let range = if start < end { start..end } else { Range::default() };

        self.events.range(range).map(|(_, v)| v)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use std::mem::size_of;

    #[test]
    fn enum_size() {
        let size = size_of::<ChatEventInternal>();
        assert_eq!(size, 16);
    }

    #[test]
    fn since() {
        let events = setup_events();

        let results = events.main.since(10.into());

        let event_indexes: Vec<u32> = results.map(|e| e.index.into()).collect();

        let max_event_index = event_indexes.last().copied().unwrap();

        assert!(event_indexes.into_iter().eq(10u32..=max_event_index));
    }

    #[test]
    fn get_range() {
        let events = setup_events();

        let results = events.main.events.range(10.into()..=20.into());

        let event_indexes: Vec<u32> = results.map(|e| e.index.into()).collect();

        assert!(event_indexes.into_iter().eq(10u32..=20));
    }

    #[test]
    fn from_index_message_limit() {
        let events = setup_events();

        let results = events.main.events.from_index(10.into(), true, 15, 100, EventIndex::default());

        assert_eq!(
            results
                .iter()
                .filter(|e| matches!(e.event, ChatEventInternal::Message(_)))
                .count(),
            15
        );
    }

    #[test]
    fn from_index_event_limit() {
        let events = setup_events();

        let results = events.main.events.from_index(10.into(), true, 25, 25, EventIndex::default());

        assert_eq!(results.len(), 25);

        let event_indexes: Vec<u32> = results.iter().map(|e| e.index.into()).collect();

        assert!(event_indexes.into_iter().eq(10u32..=34));
    }

    #[test]
    fn from_index_message_limit_rev() {
        let events = setup_events();

        let results = events
            .main
            .events
            .from_index(80.into(), false, 25, 100, EventIndex::default());

        assert_eq!(
            results
                .iter()
                .filter(|e| matches!(e.event, ChatEventInternal::Message(_)))
                .count(),
            25
        );
    }

    #[test]
    fn from_index_event_limit_rev() {
        let events = setup_events();

        let results = events.main.events.from_index(40.into(), false, 25, 25, EventIndex::default());

        assert_eq!(results.len(), 25);

        let event_indexes: Vec<u32> = results.iter().map(|e| e.index.into()).collect();

        assert!(event_indexes.into_iter().eq(16u32..=40));
    }

    #[test]
    fn from_index_start_index_exceeds_max() {
        let events = setup_events();

        let results = events
            .main
            .events
            .from_index(u32::MAX.into(), true, 25, 25, EventIndex::default());

        assert!(results.is_empty());
    }

    #[test]
    fn from_index_rev_start_index_exceeds_max() {
        let events = setup_events();

        let results = events
            .main
            .events
            .from_index(u32::MAX.into(), false, 25, 25, EventIndex::default());

        assert_eq!(results.len(), 25);

        let event_indexes: Vec<u32> = results.iter().map(|e| e.index.into()).collect();

        assert!(event_indexes.into_iter().eq(72u32..=96));
    }

    #[test]
    fn get_events_window_message_limit() {
        let events = setup_events();
        let mid_point = 21.into();

        let results = events.main.events.get_window(mid_point, 10, 100, EventIndex::default());

        assert_eq!(
            results
                .iter()
                .filter(|e| matches!(e.event, ChatEventInternal::Message(_)))
                .count(),
            10
        );
    }

    #[test]
    fn get_events_window_event_limit() {
        let events = setup_events();
        let mid_point = 21.into();

        let results = events.main.events.get_window(mid_point, 25, 25, EventIndex::default());

        assert_eq!(results.len(), 25);

        let event_indexes: Vec<u32> = results.iter().map(|e| e.index.into()).collect();

        let mid_point_index = results.iter().position(|e| e.index == mid_point);

        assert_eq!(mid_point_index.unwrap(), results.len() / 2);
        assert!(event_indexes.into_iter().eq(9u32..=33));
    }

    #[test]
    fn get_events_window_min_visible_event_index() {
        let events = setup_events();
        let mid_point = 21.into();

        let results = events.main.events.get_window(mid_point, 40, 40, 18.into());

        assert_eq!(
            results
                .iter()
                .filter(|e| matches!(e.event, ChatEventInternal::Message(_)))
                .count(),
            20
        );

        let event_indexes: Vec<u32> = results.iter().map(|e| e.index.into()).collect();

        let mid_point_index = results.iter().position(|e| e.index == mid_point);

        assert_eq!(mid_point_index.unwrap(), 3);
        assert!(event_indexes.into_iter().eq(18u32..=57));
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
