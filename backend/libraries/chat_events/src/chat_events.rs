use crate::types::{ChatEventInternal, MessageInternal, UpdatedMessageInternal};
use candid::CandidType;
use search::*;
use serde::{Deserialize, Serialize};
use std::cmp::min;
use std::collections::hash_map::Entry::Vacant;
use std::collections::{HashMap, HashSet, VecDeque};
use std::iter::FromIterator;
use std::ops::RangeInclusive;
use types::*;

#[derive(Serialize, Deserialize)]
pub struct ChatEvents {
    chat_type: ChatType,
    chat_id: ChatId,
    events: ChatEventsVec,
    message_id_map: HashMap<MessageId, EventIndex>,
    message_index_map: HashMap<MessageIndex, EventIndex>,
    latest_message_event_index: Option<EventIndex>,
    latest_message_index: Option<MessageIndex>,
    metrics: ChatMetrics,
    per_user_metrics: HashMap<UserId, ChatMetrics>,
}

#[derive(CandidType, Serialize, Deserialize)]
enum ChatType {
    Direct,
    Group,
}

pub struct PushMessageArgs {
    pub sender: UserId,
    pub message_id: MessageId,
    pub content: MessageContentInternal,
    pub replies_to: Option<ReplyContext>,
    pub now: TimestampMillis,
}

pub struct EditMessageArgs {
    pub sender: UserId,
    pub message_id: MessageId,
    pub content: MessageContent,
    pub now: TimestampMillis,
}

pub enum EditMessageResult {
    Success,
    NotAuthorized,
    NotFound,
}

pub enum DeleteMessageResult {
    Success(MessageContent),
    AlreadyDeleted,
    MessageTypeCannotBeDeleted,
    NotAuthorized,
    NotFound,
}

pub enum RegisterVoteResult {
    Success(PollVotes),
    SuccessNoChange(PollVotes),
    PollEnded,
    PollNotFound,
    OptionIndexOutOfRange,
}

pub enum EndPollResult {
    Success,
    PollNotFound,
    UnableToEndPoll,
}

pub enum ToggleReactionResult {
    Added(EventIndex),
    Removed(EventIndex),
    MessageNotFound,
}

impl ChatEvents {
    pub fn new_direct_chat(them: UserId, now: TimestampMillis) -> ChatEvents {
        let mut events = ChatEvents {
            chat_type: ChatType::Direct,
            chat_id: them.into(),
            events: ChatEventsVec::default(),
            message_id_map: HashMap::new(),
            message_index_map: HashMap::new(),
            latest_message_event_index: None,
            latest_message_index: None,
            metrics: ChatMetrics::default(),
            per_user_metrics: HashMap::new(),
        };

        events.push_event(ChatEventInternal::DirectChatCreated(DirectChatCreated {}), now);

        events
    }

    pub fn new_group_chat(
        chat_id: ChatId,
        name: String,
        description: String,
        created_by: UserId,
        now: TimestampMillis,
    ) -> ChatEvents {
        let mut events = ChatEvents {
            chat_type: ChatType::Group,
            chat_id,
            events: ChatEventsVec::default(),
            message_id_map: HashMap::new(),
            message_index_map: HashMap::new(),
            latest_message_event_index: None,
            latest_message_index: None,
            metrics: ChatMetrics::default(),
            per_user_metrics: HashMap::new(),
        };

        events.push_event(
            ChatEventInternal::GroupChatCreated(Box::new(GroupChatCreated {
                name,
                description,
                created_by,
            })),
            now,
        );

        events
    }

    pub fn get(&self, event_index: EventIndex) -> Option<&EventWrapper<ChatEventInternal>> {
        self.events.get(event_index)
    }

    pub fn get_mut(&mut self, event_index: EventIndex) -> Option<&mut EventWrapper<ChatEventInternal>> {
        self.events.get_mut(event_index)
    }

    pub fn message_by_message_index(&self, message_index: MessageIndex) -> Option<EventWrapper<&MessageInternal>> {
        self.message_index_map
            .get(&message_index)
            .and_then(|e| self.get(*e))
            .and_then(|e| e.event.as_message().map(|m| (e, m)))
            .map(|(e, m)| EventWrapper {
                index: e.index,
                timestamp: e.timestamp,
                event: m,
            })
    }

    pub fn push_message(&mut self, args: PushMessageArgs) -> EventWrapper<Message> {
        let message_index = self.next_message_index();
        let message_internal = MessageInternal {
            message_index,
            message_id: args.message_id,
            sender: args.sender,
            content: args.content,
            replies_to: args.replies_to,
            reactions: Vec::new(),
            last_updated: None,
            last_edited: None,
            deleted_by: None,
        };
        let message = self.hydrate_message(&message_internal, Some(message_internal.sender));
        let event_index = self.push_event(ChatEventInternal::Message(Box::new(message_internal)), args.now);

        EventWrapper {
            index: event_index,
            timestamp: args.now,
            event: message,
        }
    }

    pub fn push_event(&mut self, event: ChatEventInternal, now: TimestampMillis) -> EventIndex {
        let valid = match self.chat_type {
            ChatType::Direct => event.is_valid_for_direct_chat(),
            ChatType::Group => event.is_valid_for_group_chat(),
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
            self.latest_message_index = Some(m.message_index);
            self.latest_message_event_index = Some(event_index);
        }

        event.add_to_metrics(&mut self.metrics, &mut self.per_user_metrics, now);

        self.events.push(EventWrapper {
            index: event_index,
            timestamp: now,
            event,
        });

        event_index
    }

    pub fn edit_message(&mut self, args: EditMessageArgs) -> EditMessageResult {
        if let Some(message) = self
            .get_event_index_by_message_id(args.message_id)
            .and_then(|e| self.events.get_mut(e))
            .and_then(|e| e.event.as_message_mut())
        {
            if message.sender == args.sender {
                if matches!(message.content, MessageContentInternal::Deleted(_)) {
                    EditMessageResult::NotFound
                } else {
                    message.content = args.content.new_content_into_internal();
                    message.last_updated = Some(args.now);
                    message.last_edited = Some(args.now);
                    self.push_event(
                        ChatEventInternal::MessageEdited(Box::new(UpdatedMessageInternal {
                            updated_by: args.sender,
                            message_id: args.message_id,
                        })),
                        args.now,
                    );
                    EditMessageResult::Success
                }
            } else {
                EditMessageResult::NotAuthorized
            }
        } else {
            EditMessageResult::NotFound
        }
    }

    pub fn delete_message(
        &mut self,
        caller: UserId,
        is_admin: bool,
        message_id: MessageId,
        now: TimestampMillis,
    ) -> DeleteMessageResult {
        if let Some(message) = self
            .get_event_index_by_message_id(message_id)
            .and_then(|e| self.events.get_mut(e))
            .and_then(|e| e.event.as_message_mut())
        {
            if message.sender == caller || is_admin {
                if message.deleted_by.is_some() {
                    return DeleteMessageResult::AlreadyDeleted;
                }
                match message.content {
                    MessageContentInternal::Deleted(_) => DeleteMessageResult::AlreadyDeleted,
                    MessageContentInternal::Cryptocurrency(_) => DeleteMessageResult::MessageTypeCannotBeDeleted,
                    _ => {
                        message.remove_from_metrics(&mut self.metrics, &mut self.per_user_metrics);

                        message.last_updated = Some(now);
                        message.deleted_by = Some(DeletedBy {
                            deleted_by: caller,
                            timestamp: now,
                        });

                        let message_content = message.content.hydrate(Some(caller));

                        self.push_event(
                            ChatEventInternal::MessageDeleted(Box::new(UpdatedMessageInternal {
                                updated_by: caller,
                                message_id,
                            })),
                            now,
                        );
                        DeleteMessageResult::Success(message_content)
                    }
                }
            } else {
                DeleteMessageResult::NotAuthorized
            }
        } else {
            DeleteMessageResult::NotFound
        }
    }

    pub fn register_poll_vote(
        &mut self,
        user_id: UserId,
        message_index: MessageIndex,
        option_index: u32,
        operation: VoteOperation,
        now: TimestampMillis,
    ) -> RegisterVoteResult {
        if let Some(message) = self
            .get_event_index_by_message_index(message_index)
            .and_then(|e| self.events.get_mut(e))
            .and_then(|e| e.event.as_message_mut())
        {
            if let MessageContentInternal::Poll(p) = &mut message.content {
                return match p.register_vote(user_id, option_index, operation) {
                    types::RegisterVoteResult::Success(existing_vote_removed) => {
                        message.last_updated = Some(now);
                        let event = match operation {
                            VoteOperation::RegisterVote => {
                                ChatEventInternal::PollVoteRegistered(Box::new(PollVoteRegistered {
                                    user_id,
                                    message_id: message.message_id,
                                    existing_vote_removed,
                                }))
                            }
                            VoteOperation::DeleteVote => ChatEventInternal::PollVoteDeleted(Box::new(UpdatedMessageInternal {
                                updated_by: user_id,
                                message_id: message.message_id,
                            })),
                        };
                        let votes = p.hydrate(Some(user_id)).votes;
                        self.push_event(event, now);
                        RegisterVoteResult::Success(votes)
                    }
                    types::RegisterVoteResult::SuccessNoChange => {
                        RegisterVoteResult::SuccessNoChange(p.hydrate(Some(user_id)).votes)
                    }
                    types::RegisterVoteResult::PollEnded => RegisterVoteResult::PollEnded,
                    types::RegisterVoteResult::OptionIndexOutOfRange => RegisterVoteResult::OptionIndexOutOfRange,
                };
            }
        }
        RegisterVoteResult::PollNotFound
    }

    pub fn end_poll(&mut self, message_index: MessageIndex, now: TimestampMillis) -> EndPollResult {
        if let Some(message) = self
            .get_event_index_by_message_index(message_index)
            .and_then(|e| self.events.get_mut(e))
            .and_then(|e| e.event.as_message_mut())
        {
            if let MessageContentInternal::Poll(p) = &mut message.content {
                return if p.ended || p.config.end_date.is_none() {
                    EndPollResult::UnableToEndPoll
                } else {
                    message.last_updated = Some(now);
                    p.ended = true;
                    let event = ChatEventInternal::PollEnded(Box::new(message_index));
                    self.push_event(event, now);
                    EndPollResult::Success
                };
            }
        }
        EndPollResult::PollNotFound
    }

    pub fn toggle_reaction(
        &mut self,
        user_id: UserId,
        message_id: MessageId,
        reaction: Reaction,
        now: TimestampMillis,
    ) -> ToggleReactionResult {
        if !reaction.is_valid() {
            // This should never happen because we validate earlier
            panic!("Invalid reaction: {reaction:?}");
        }

        if let Some(message) = self
            .get_event_index_by_message_id(message_id)
            .and_then(|e| self.events.get_mut(e))
            .and_then(|e| e.event.as_message_mut())
        {
            message.last_updated = Some(now);

            let added = if let Some((_, users)) = message.reactions.iter_mut().find(|(r, _)| *r == reaction) {
                if users.insert(user_id) {
                    true
                } else {
                    users.remove(&user_id);
                    if users.is_empty() {
                        message.reactions.retain(|(r, _)| *r != reaction);
                    }
                    false
                }
            } else {
                message.reactions.push((reaction, vec![user_id].into_iter().collect()));
                true
            };

            if added {
                let new_event_index = self.push_event(
                    ChatEventInternal::MessageReactionAdded(Box::new(UpdatedMessageInternal {
                        updated_by: user_id,
                        message_id,
                    })),
                    now,
                );
                ToggleReactionResult::Added(new_event_index)
            } else {
                let new_event_index = self.push_event(
                    ChatEventInternal::MessageReactionRemoved(Box::new(UpdatedMessageInternal {
                        updated_by: user_id,
                        message_id,
                    })),
                    now,
                );
                ToggleReactionResult::Removed(new_event_index)
            }
        } else {
            ToggleReactionResult::MessageNotFound
        }
    }

    pub fn reaction_exists(&self, added_by: UserId, message_id: MessageId, reaction: &Reaction) -> bool {
        self.get_event_index_by_message_id(message_id)
            .and_then(|e| self.events.get(e))
            .and_then(|e| e.event.as_message())
            .and_then(|m| m.reactions.iter().find(|(r, _)| r == reaction))
            .map(|(_, users)| users.contains(&added_by))
            .unwrap_or_default()
    }

    pub fn latest_message(&self, my_user_id: Option<UserId>) -> Option<EventWrapper<Message>> {
        self.latest_message_if_updated(0, my_user_id)
    }

    pub fn latest_message_if_updated(
        &self,
        since: TimestampMillis,
        my_user_id: Option<UserId>,
    ) -> Option<EventWrapper<Message>> {
        let event_index = self.latest_message_event_index?;
        let event = self.get(event_index)?;
        let message = event.event.as_message()?;

        if event.timestamp > since || message.last_updated.unwrap_or(0) > since {
            Some(EventWrapper {
                index: event.index,
                timestamp: event.timestamp,
                event: self.hydrate_message(message, my_user_id),
            })
        } else {
            None
        }
    }

    pub fn last(&self) -> &EventWrapper<ChatEventInternal> {
        self.events.inner().last().unwrap()
    }

    pub fn latest_message_index(&self) -> Option<MessageIndex> {
        self.latest_message_index
    }

    pub fn next_message_index(&self) -> MessageIndex {
        self.latest_message_index.map_or(MessageIndex::default(), |m| m.incr())
    }

    pub fn iter(&self) -> impl DoubleEndedIterator<Item = &EventWrapper<ChatEventInternal>> {
        self.events.inner().iter()
    }

    pub fn since(&self, event_index: EventIndex) -> &[EventWrapper<ChatEventInternal>] {
        self.events.since(event_index)
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
            forwarded: false,
        }
    }

    pub fn hydrate_updated_message(&self, message: &UpdatedMessageInternal) -> UpdatedMessage {
        UpdatedMessage {
            updated_by: message.updated_by,
            event_index: self.get_event_index_by_message_id(message.message_id).unwrap_or_default(),
            message_id: message.message_id,
        }
    }

    pub fn hydrate_poll_vote_registered(&self, poll_vote_registered: &PollVoteRegistered) -> UpdatedMessage {
        UpdatedMessage {
            updated_by: poll_vote_registered.user_id,
            event_index: self
                .get_event_index_by_message_id(poll_vote_registered.message_id)
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

    pub fn search_messages(
        &self,
        now: TimestampMillis,
        min_visible_event_index: EventIndex,
        search_term: &str,
        max_results: u8,
        my_user_id: UserId,
    ) -> Vec<MessageMatch> {
        let query = Query::parse(search_term);

        let mut matches: Vec<_> = self
            .events
            .since(min_visible_event_index)
            .iter()
            .filter_map(|e| e.event.as_message().map(|m| (e, m)))
            .filter_map(|(e, m)| {
                let mut document: Document = (&m.content).into();
                document.set_age(now - e.timestamp);
                match document.calculate_score(&query) {
                    0 => None,
                    n => Some((n, m)),
                }
            })
            .collect();

        matches.sort_unstable_by_key(|(s, _)| *s);

        matches
            .iter()
            .take(max_results as usize)
            .map(|(s, m)| MessageMatch {
                chat_id: self.chat_id,
                message_index: m.message_index,
                sender: m.sender,
                content: m.content.hydrate(Some(my_user_id)),
                score: *s,
            })
            .collect()
    }

    pub fn get_range(&self, from_event_index: EventIndex, to_event_index: EventIndex) -> &[EventWrapper<ChatEventInternal>] {
        self.events.get_range(from_event_index..=to_event_index)
    }

    pub fn get_by_index(&self, indexes: Vec<EventIndex>) -> Vec<&EventWrapper<ChatEventInternal>> {
        self.events.get_by_index(&indexes)
    }

    pub fn from_index(
        &self,
        start: EventIndex,
        ascending: bool,
        max_messages: usize,
        max_events: usize,
        min_visible_event_index: EventIndex,
    ) -> Vec<&EventWrapper<ChatEventInternal>> {
        self.events
            .from_index(start, ascending, max_messages, max_events, min_visible_event_index)
    }

    pub fn get_events_window(
        &self,
        mid_point: EventIndex,
        max_messages: usize,
        max_events: usize,
        min_visible_event_index: EventIndex,
    ) -> Vec<&EventWrapper<ChatEventInternal>> {
        self.events
            .get_window(mid_point, max_messages, max_events, min_visible_event_index)
    }

    pub fn get_event_index_by_message_index(&self, message_index: MessageIndex) -> Option<EventIndex> {
        self.message_index_map.get(&message_index).copied()
    }

    pub fn get_event_index_by_message_id(&self, message_id: MessageId) -> Option<EventIndex> {
        self.message_id_map.get(&message_id).copied()
    }

    pub fn get_message_id_by_event_index(&self, event_index: EventIndex) -> Option<MessageId> {
        self.get(event_index).and_then(|e| e.event.as_message()).map(|m| m.message_id)
    }

    pub fn get_message_index(&self, message_id: MessageId) -> Option<MessageIndex> {
        self.message_id_map
            .get(&message_id)
            .and_then(|e| self.get(*e))
            .and_then(|e| e.event.as_message())
            .map(|m| m.message_index)
    }

    pub fn hydrate_mention(&self, message_index: &MessageIndex) -> Option<Mention> {
        let event_index = *self.message_index_map.get(message_index)?;

        self.get(event_index).and_then(|e| e.event.as_message()).map(|m| Mention {
            message_id: m.message_id,
            message_index: m.message_index,
            event_index,
            mentioned_by: m.sender,
        })
    }

    pub fn affected_event_indexes_since(&self, since: TimestampMillis, max_results: usize) -> Vec<EventIndex> {
        let mut affected_events = HashSet::new();

        for EventWrapper { event, .. } in self.events.inner().iter().rev().take_while(|e| e.timestamp > since) {
            if let Some(index) = self.affected_event_index(event) {
                if affected_events.insert(index) && affected_events.len() == max_results {
                    break;
                }
            }
        }

        affected_events.into_iter().collect()
    }

    pub fn affected_event_index(&self, event: &ChatEventInternal) -> Option<EventIndex> {
        match event {
            ChatEventInternal::MessageEdited(m) => self.message_id_map.get(&m.message_id).copied(),
            ChatEventInternal::MessageDeleted(m) => self.message_id_map.get(&m.message_id).copied(),
            ChatEventInternal::MessageReactionAdded(r) => self.message_id_map.get(&r.message_id).copied(),
            ChatEventInternal::MessageReactionRemoved(r) => self.message_id_map.get(&r.message_id).copied(),
            ChatEventInternal::PollVoteRegistered(v) => self.message_id_map.get(&v.message_id).copied(),
            ChatEventInternal::PollVoteDeleted(v) => self.message_id_map.get(&v.message_id).copied(),
            ChatEventInternal::PollEnded(p) => self.message_index_map.get(p).copied(),
            _ => None,
        }
    }

    pub fn metrics(&self) -> &ChatMetrics {
        &self.metrics
    }

    pub fn user_metrics(&self, user_id: &UserId, if_updated_since: Option<TimestampMillis>) -> Option<&ChatMetrics> {
        self.per_user_metrics
            .get(user_id)
            .filter(|m| if let Some(since) = if_updated_since { m.last_active > since } else { true })
    }

    pub fn len(&self) -> usize {
        self.events.inner().len()
    }

    pub fn is_empty(&self) -> bool {
        self.events.inner().is_empty()
    }
}

#[derive(Serialize, Deserialize, Default)]
#[serde(from = "Vec<EventWrapper<ChatEventInternal>>")]
struct ChatEventsVec {
    events: Vec<EventWrapper<ChatEventInternal>>,
}

impl From<Vec<EventWrapper<ChatEventInternal>>> for ChatEventsVec {
    fn from(events: Vec<EventWrapper<ChatEventInternal>>) -> Self {
        ChatEventsVec { events }
    }
}

impl ChatEventsVec {
    pub fn push(&mut self, event: EventWrapper<ChatEventInternal>) {
        if event.index != self.next_event_index() {
            panic!(
                "Incorrect event index. Expected: {}. Got: {}",
                self.next_event_index(),
                event.index
            );
        }
        self.events.push(event);
    }

    pub fn get(&self, event_index: EventIndex) -> Option<&EventWrapper<ChatEventInternal>> {
        let offset = self.offset()?;
        let index = usize::from(event_index).checked_sub(offset)?;
        self.events.get(index)
    }

    pub fn get_mut(&mut self, event_index: EventIndex) -> Option<&mut EventWrapper<ChatEventInternal>> {
        let offset = self.offset()?;
        let index = usize::from(event_index).checked_sub(offset)?;
        self.events.get_mut(index)
    }

    pub fn since(&self, event_index: EventIndex) -> &[EventWrapper<ChatEventInternal>] {
        self.get_range(event_index..=u32::MAX.into())
    }

    pub fn get_range(&self, range: RangeInclusive<EventIndex>) -> &[EventWrapper<ChatEventInternal>] {
        if let Some(offset) = self.offset() {
            if let Some(end) = usize::from(*range.end()).checked_sub(offset) {
                let start = usize::from(*range.start()).saturating_sub(offset);
                if start < self.events.len() {
                    let end = min(end, self.events.len().saturating_sub(1));
                    return &self.events[start..=end];
                }
            }
        }

        &[]
    }

    pub fn get_by_index(&self, indexes: &[EventIndex]) -> Vec<&EventWrapper<ChatEventInternal>> {
        self.offset()
            .map(|offset| {
                indexes
                    .iter()
                    .filter_map(|i| usize::from(*i).checked_sub(offset))
                    .filter_map(|i| self.events.get(i))
                    .collect()
            })
            .unwrap_or_default()
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
        if let Some(start_index) = self.offset().and_then(|o| usize::from(start).checked_sub(o)) {
            let iter: Box<dyn Iterator<Item = &EventWrapper<ChatEventInternal>>> = if ascending {
                let range = &self.events[start_index..];
                Box::new(range.iter())
            } else {
                let range = &self.events[..=start_index];
                Box::new(range.iter().rev())
            };

            let mut events = Vec::new();
            let mut message_count = 0;
            for event in iter.take_while(|e| e.index >= min_visible_event_index).take(max_events) {
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
        } else {
            Vec::new()
        }
    }

    pub fn get_window(
        &self,
        mid_point: EventIndex,
        max_messages: usize,
        max_events: usize,
        min_visible_event_index: EventIndex,
    ) -> Vec<&EventWrapper<ChatEventInternal>> {
        if mid_point >= min_visible_event_index {
            if let Some(offset) = self.offset() {
                if let Some(mid_point_index) = usize::from(mid_point).checked_sub(offset) {
                    let min_visible_index = usize::from(min_visible_event_index).saturating_sub(offset);
                    let mut forwards_iter = self.events[mid_point_index..].iter();
                    let mut backwards_iter = self.events[min_visible_index..mid_point_index].iter().rev();

                    let mut events = VecDeque::new();
                    let mut message_count = 0;

                    let mut max_reached = false;
                    let mut min_reached = false;

                    let mut iter_forwards = true;

                    // Alternates between iterating forwards and backwards (unless either end is
                    // reached) adding one event each time until the message limit is reached, the
                    // event limit is reached, or there are no more events available.
                    loop {
                        if message_count == max_messages || events.len() == max_events || (min_reached && max_reached) {
                            break;
                        }

                        if iter_forwards {
                            if let Some(next) = forwards_iter.next() {
                                if matches!(next.event, ChatEventInternal::Message(_)) {
                                    message_count += 1;
                                }
                                events.push_back(next);
                            } else {
                                max_reached = true;
                            }
                            if !min_reached {
                                iter_forwards = false;
                            }
                        } else {
                            if let Some(previous) = backwards_iter.next() {
                                if matches!(previous.event, ChatEventInternal::Message(_)) {
                                    message_count += 1;
                                }
                                events.push_front(previous);
                            } else {
                                min_reached = true;
                            }
                            if !max_reached {
                                iter_forwards = true;
                            }
                        }
                    }

                    return Vec::from_iter(events);
                }
            }
        }
        Vec::new()
    }

    pub fn next_event_index(&self) -> EventIndex {
        self.events.last().map_or(EventIndex::default(), |e| e.index.incr())
    }

    pub fn inner(&self) -> &[EventWrapper<ChatEventInternal>] {
        &self.events
    }

    fn offset(&self) -> Option<usize> {
        self.events.first().map(|e| e.index.into())
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

        let results = events.since(10.into());

        let event_indexes: Vec<u32> = results.iter().map(|e| e.index.into()).collect();

        let max_event_index = results.last().unwrap().index.into();

        assert!(event_indexes.into_iter().eq(10u32..=max_event_index));
    }

    #[test]
    fn get_range() {
        let events = setup_events();

        let results = events.get_range(10.into(), 20.into());

        let event_indexes: Vec<u32> = results.iter().map(|e| e.index.into()).collect();

        assert!(event_indexes.into_iter().eq(10u32..=20));
    }

    #[test]
    fn from_index_message_limit() {
        let events = setup_events();

        let results = events.from_index(10.into(), true, 10, 40, EventIndex::default());

        assert_eq!(
            results
                .iter()
                .filter(|e| matches!(e.event, ChatEventInternal::Message(_)))
                .count(),
            10
        );

        let event_indexes: Vec<u32> = results.iter().map(|e| e.index.into()).collect();

        assert!(event_indexes.into_iter().eq(10u32..=29));
    }

    #[test]
    fn from_index_message_limit_rev() {
        let events = setup_events();

        let results = events.from_index(40.into(), false, 10, 40, EventIndex::default());

        assert_eq!(
            results
                .iter()
                .filter(|e| matches!(e.event, ChatEventInternal::Message(_)))
                .count(),
            10
        );

        let event_indexes: Vec<u32> = results.iter().map(|e| e.index.into()).collect();

        assert!(event_indexes.into_iter().eq(21u32..=40));
    }

    #[test]
    fn from_index_event_limit() {
        let events = setup_events();

        let results = events.from_index(10.into(), true, 15, 25, EventIndex::default());

        assert_eq!(results.len(), 25);

        let event_indexes: Vec<u32> = results.iter().map(|e| e.index.into()).collect();

        assert!(event_indexes.into_iter().eq(10u32..=34));
    }

    #[test]
    fn from_index_event_limit_rev() {
        let events = setup_events();

        let results = events.from_index(40.into(), false, 15, 25, EventIndex::default());

        assert_eq!(results.len(), 25);

        let event_indexes: Vec<u32> = results.iter().map(|e| e.index.into()).collect();

        assert!(event_indexes.into_iter().eq(16u32..=40));
    }

    #[test]
    fn get_events_window_message_limit() {
        let events = setup_events();
        let mid_point = 21.into();

        let results = events.get_events_window(mid_point, 10, 40, EventIndex::default());

        assert_eq!(
            results
                .iter()
                .filter(|e| matches!(e.event, ChatEventInternal::Message(_)))
                .count(),
            10
        );

        let event_indexes: Vec<u32> = results.iter().map(|e| e.index.into()).collect();

        let mid_point_index = results.iter().position(|e| e.index == mid_point);

        assert_eq!(mid_point_index.unwrap(), results.len() / 2);
        assert!(event_indexes.into_iter().eq(11u32..=30));
    }

    #[test]
    fn get_events_window_event_limit() {
        let events = setup_events();
        let mid_point = 21.into();

        let results = events.get_events_window(mid_point, 15, 25, EventIndex::default());

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

        let results = events.get_events_window(mid_point, 10, 40, 18.into());

        assert_eq!(
            results
                .iter()
                .filter(|e| matches!(e.event, ChatEventInternal::Message(_)))
                .count(),
            10
        );

        let event_indexes: Vec<u32> = results.iter().map(|e| e.index.into()).collect();

        let mid_point_index = results.iter().position(|e| e.index == mid_point);

        assert_eq!(mid_point_index.unwrap(), 3);
        assert!(event_indexes.into_iter().eq(18u32..=37));
    }

    fn setup_events() -> ChatEvents {
        let user_id = Principal::from_slice(&[1]).into();

        let mut events = ChatEvents::new_direct_chat(Principal::from_slice(&[2]).into(), 1);

        for i in 2..50 {
            let message_id = i.into();
            events.push_message(PushMessageArgs {
                sender: user_id,
                message_id,
                content: MessageContentInternal::Text(TextContent {
                    text: "hello".to_owned(),
                }),
                replies_to: None,
                now: i as u64,
            });
            events.push_event(
                ChatEventInternal::MessageReactionAdded(Box::new(UpdatedMessageInternal {
                    updated_by: user_id,
                    message_id,
                })),
                i as u64,
            );
        }

        events
    }
}
