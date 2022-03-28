use candid::CandidType;
use search::*;
use serde::{Deserialize, Serialize};
use std::cmp::{max, min};
use std::collections::hash_map::Entry::Vacant;
use std::collections::{HashMap, HashSet, VecDeque};
use std::iter::FromIterator;
use std::mem::replace;
use types::*;

#[derive(CandidType, Serialize, Deserialize)]
pub struct ChatEvents {
    chat_type: ChatType,
    chat_id: ChatId,
    events: Vec<EventWrapper<ChatEventInternal>>,
    message_id_map: HashMap<MessageId, EventIndex>,
    message_index_map: HashMap<MessageIndex, EventIndex>,
    latest_message_event_index: Option<EventIndex>,
    latest_message_index: Option<MessageIndex>,
    metrics: Metrics,
}

#[derive(CandidType, Serialize, Deserialize)]
enum ChatType {
    Direct,
    Group,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ChatEventInternal {
    Message(Box<MessageInternal>),
    MessageEdited(Box<UpdatedMessageInternal>),
    MessageDeleted(Box<UpdatedMessageInternal>),
    MessageReactionAdded(Box<UpdatedMessageInternal>),
    MessageReactionRemoved(Box<UpdatedMessageInternal>),
    DirectChatCreated(DirectChatCreated),
    GroupChatCreated(Box<GroupChatCreated>),
    GroupNameChanged(Box<GroupNameChanged>),
    GroupDescriptionChanged(Box<GroupDescriptionChanged>),
    AvatarChanged(Box<AvatarChanged>),
    OwnershipTransferred(Box<OwnershipTransferred>),
    ParticipantsAdded(Box<ParticipantsAdded>),
    ParticipantsRemoved(Box<ParticipantsRemoved>),
    ParticipantJoined(Box<ParticipantJoined>),
    ParticipantLeft(Box<ParticipantLeft>),
    ParticipantAssumesSuperAdmin(Box<ParticipantAssumesSuperAdmin>),
    ParticipantDismissedAsSuperAdmin(Box<ParticipantDismissedAsSuperAdmin>),
    ParticipantRelinquishesSuperAdmin(Box<ParticipantRelinquishesSuperAdmin>),
    RoleChanged(Box<RoleChanged>),
    UsersBlocked(Box<UsersBlocked>),
    UsersUnblocked(Box<UsersUnblocked>),
    MessagePinned(Box<MessagePinned>),
    MessageUnpinned(Box<MessageUnpinned>),
    PollVoteRegistered(Box<UpdatedMessageInternal>),
    PollVoteDeleted(Box<UpdatedMessageInternal>),
    PollEnded(Box<MessageIndex>),
    PermissionsChanged(Box<PermissionsChanged>),
}

impl ChatEventInternal {
    fn is_valid_for_direct_chat(&self) -> bool {
        matches!(
            self,
            ChatEventInternal::Message(_)
                | ChatEventInternal::MessageEdited(_)
                | ChatEventInternal::MessageDeleted(_)
                | ChatEventInternal::MessageReactionAdded(_)
                | ChatEventInternal::MessageReactionRemoved(_)
                | ChatEventInternal::DirectChatCreated(_)
                | ChatEventInternal::PollVoteRegistered(_)
                | ChatEventInternal::PollVoteDeleted(_)
                | ChatEventInternal::PollEnded(_)
        )
    }

    fn is_valid_for_group_chat(&self) -> bool {
        matches!(
            self,
            ChatEventInternal::Message(_)
                | ChatEventInternal::MessageEdited(_)
                | ChatEventInternal::MessageDeleted(_)
                | ChatEventInternal::MessageReactionAdded(_)
                | ChatEventInternal::MessageReactionRemoved(_)
                | ChatEventInternal::GroupChatCreated(_)
                | ChatEventInternal::GroupNameChanged(_)
                | ChatEventInternal::GroupDescriptionChanged(_)
                | ChatEventInternal::AvatarChanged(_)
                | ChatEventInternal::OwnershipTransferred(_)
                | ChatEventInternal::ParticipantsAdded(_)
                | ChatEventInternal::ParticipantsRemoved(_)
                | ChatEventInternal::ParticipantJoined(_)
                | ChatEventInternal::ParticipantLeft(_)
                | ChatEventInternal::ParticipantAssumesSuperAdmin(_)
                | ChatEventInternal::ParticipantDismissedAsSuperAdmin(_)
                | ChatEventInternal::ParticipantRelinquishesSuperAdmin(_)
                | ChatEventInternal::RoleChanged(_)
                | ChatEventInternal::UsersBlocked(_)
                | ChatEventInternal::UsersUnblocked(_)
                | ChatEventInternal::MessagePinned(_)
                | ChatEventInternal::MessageUnpinned(_)
                | ChatEventInternal::PollVoteRegistered(_)
                | ChatEventInternal::PollVoteDeleted(_)
                | ChatEventInternal::PollEnded(_)
                | ChatEventInternal::PermissionsChanged(_)
        )
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MessageInternal {
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sender: UserId,
    pub content: MessageContentInternal,
    pub replies_to: Option<ReplyContext>,
    pub reactions: Vec<(Reaction, HashSet<UserId>)>,
    pub last_updated: Option<TimestampMillis>,
    #[serde(default)]
    pub last_edited: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UpdatedMessageInternal {
    pub updated_by: UserId,
    pub message_id: MessageId,
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

#[derive(CandidType, Serialize, Deserialize, Debug, Default, Clone)]
pub struct Metrics {
    pub text_messages: u64,
    pub image_messages: u64,
    pub video_messages: u64,
    pub audio_messages: u64,
    pub file_messages: u64,
    pub polls: u64,
    pub poll_votes: u64,
    pub cycles_messages: u64,
    pub icp_messages: u64,
    pub deleted_messages: u64,
    pub replies: u64,
    pub total_edits: u64,
    pub total_reactions: u64,
    pub total_events: u64,
    pub last_active: TimestampMillis,
}

impl ChatEvents {
    pub fn new_direct_chat(them: UserId, now: TimestampMillis) -> ChatEvents {
        let mut events = ChatEvents {
            chat_type: ChatType::Direct,
            chat_id: them.into(),
            events: Vec::new(),
            message_id_map: HashMap::new(),
            message_index_map: HashMap::new(),
            latest_message_event_index: None,
            latest_message_index: None,
            metrics: Metrics::default(),
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
            events: Vec::new(),
            message_id_map: HashMap::new(),
            message_index_map: HashMap::new(),
            latest_message_event_index: None,
            latest_message_index: None,
            metrics: Metrics::default(),
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
        let index = self.get_index(event_index)?;
        self.events.get(index)
    }

    pub fn get_mut(&mut self, event_index: EventIndex) -> Option<&mut EventWrapper<ChatEventInternal>> {
        let index = self.get_index(event_index)?;
        self.events.get_mut(index)
    }

    pub fn message_by_message_index(&self, message_index: MessageIndex) -> Option<EventWrapper<&MessageInternal>> {
        let event_index = self.message_index_map.get(&message_index)?;
        let event_wrapper = self.get(*event_index)?;

        if let ChatEventInternal::Message(m) = &event_wrapper.event {
            Some(EventWrapper {
                index: event_wrapper.index,
                timestamp: event_wrapper.timestamp,
                event: m,
            })
        } else {
            None
        }
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

        let event_index = self.events.last().map_or(EventIndex::default(), |e| e.index.incr());
        if let ChatEventInternal::Message(m) = &event {
            match self.message_id_map.entry(m.message_id) {
                Vacant(e) => e.insert(event_index),
                _ => panic!("MessageId already used: {:?}", m.message_id),
            };
            self.message_index_map.insert(m.message_index, event_index);
            self.latest_message_index = Some(m.message_index);
            self.latest_message_event_index = Some(event_index);

            match &m.content {
                MessageContentInternal::Text(_) => self.metrics.text_messages += 1,
                MessageContentInternal::Image(_) => self.metrics.image_messages += 1,
                MessageContentInternal::Video(_) => self.metrics.video_messages += 1,
                MessageContentInternal::Audio(_) => self.metrics.audio_messages += 1,
                MessageContentInternal::File(_) => self.metrics.file_messages += 1,
                MessageContentInternal::Poll(p) => {
                    self.metrics.polls += 1;
                    self.metrics.poll_votes += p.votes.values().map(|v| v.len() as u64).sum::<u64>();
                }
                MessageContentInternal::Cryptocurrency(c) => match c.transfer {
                    CryptocurrencyTransfer::Cycles(_) => self.metrics.cycles_messages += 1,
                    CryptocurrencyTransfer::ICP(_) => self.metrics.icp_messages += 1,
                },
                MessageContentInternal::Deleted(_) => self.metrics.deleted_messages += 1,
            }

            if m.replies_to.is_some() {
                self.metrics.replies += 1;
            }
        }
        self.events.push(EventWrapper {
            index: event_index,
            timestamp: now,
            event,
        });
        event_index
    }

    pub fn edit_message(&mut self, args: EditMessageArgs) -> EditMessageResult {
        if let Some(message) = self.get_message_by_id_internal_mut(args.message_id) {
            if message.sender == args.sender {
                if matches!(message.content, MessageContentInternal::Deleted(_)) {
                    EditMessageResult::NotFound
                } else {
                    message.content = args.content.new_content_into_internal();
                    message.last_updated = Some(args.now);
                    message.last_edited = Some(args.now);
                    self.metrics.total_edits += 1;
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
        if let Some(message) = self.get_message_by_id_internal_mut(message_id) {
            if message.sender == caller || is_admin {
                match message.content {
                    MessageContentInternal::Deleted(_) => DeleteMessageResult::AlreadyDeleted,
                    MessageContentInternal::Cryptocurrency(_) => DeleteMessageResult::MessageTypeCannotBeDeleted,
                    _ => {
                        let previous_content = replace(
                            &mut message.content,
                            MessageContentInternal::Deleted(DeletedContent {
                                deleted_by: caller,
                                timestamp: now,
                            }),
                        );
                        message.last_updated = Some(now);
                        self.metrics.deleted_messages += 1;
                        self.push_event(
                            ChatEventInternal::MessageDeleted(Box::new(UpdatedMessageInternal {
                                updated_by: caller,
                                message_id,
                            })),
                            now,
                        );
                        DeleteMessageResult::Success(previous_content.hydrate(Some(caller)))
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
        if let Some(message) = self.get_message_by_message_index_internal_mut(message_index) {
            if let MessageContentInternal::Poll(p) = &mut message.content {
                return match p.register_vote(user_id, option_index, operation) {
                    types::RegisterVoteResult::Success => {
                        message.last_updated = Some(now);
                        let updated_message = Box::new(UpdatedMessageInternal {
                            updated_by: user_id,
                            message_id: message.message_id,
                        });
                        let event = match operation {
                            VoteOperation::RegisterVote => ChatEventInternal::PollVoteRegistered(updated_message),
                            VoteOperation::DeleteVote => ChatEventInternal::PollVoteDeleted(updated_message),
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
        if let Some(message) = self.get_message_by_message_index_internal_mut(message_index) {
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

        if let Some(&event_index) = self.message_id_map.get(&message_id) {
            if let Some(ChatEventInternal::Message(message)) = self.get_mut(event_index).map(|e| &mut e.event) {
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

                return if added {
                    self.metrics.total_reactions += 1;
                    let new_event_index = self.push_event(
                        ChatEventInternal::MessageReactionAdded(Box::new(UpdatedMessageInternal {
                            updated_by: user_id,
                            message_id,
                        })),
                        now,
                    );
                    ToggleReactionResult::Added(new_event_index)
                } else {
                    self.metrics.total_reactions -= 1;
                    let new_event_index = self.push_event(
                        ChatEventInternal::MessageReactionRemoved(Box::new(UpdatedMessageInternal {
                            updated_by: user_id,
                            message_id,
                        })),
                        now,
                    );
                    ToggleReactionResult::Removed(new_event_index)
                };
            }
        }

        ToggleReactionResult::MessageNotFound
    }

    pub fn reaction_exists(&self, added_by: UserId, message_id: &MessageId, reaction: &Reaction) -> bool {
        if let Some(&event_index) = self.message_id_map.get(message_id) {
            if let Some(ChatEventInternal::Message(message)) = self.get(event_index).map(|e| &e.event) {
                if let Some((_, users)) = message.reactions.iter().find(|(r, _)| r == reaction) {
                    return users.contains(&added_by);
                }
            }
        }
        false
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

        if let ChatEventInternal::Message(m) = &event.event {
            if event.timestamp > since || m.last_updated.unwrap_or(0) > since {
                return Some(EventWrapper {
                    index: event.index,
                    timestamp: event.timestamp,
                    event: self.hydrate_message(m, my_user_id),
                });
            }
        }
        None
    }

    pub fn last(&self) -> &EventWrapper<ChatEventInternal> {
        self.events.last().unwrap()
    }

    pub fn latest_message_index(&self) -> Option<MessageIndex> {
        self.latest_message_index
    }

    pub fn next_message_index(&self) -> MessageIndex {
        self.latest_message_index.map_or(MessageIndex::default(), |m| m.incr())
    }

    pub fn iter(&self) -> impl DoubleEndedIterator<Item = &EventWrapper<ChatEventInternal>> {
        self.events.iter()
    }

    pub fn since(&self, index: EventIndex) -> &[EventWrapper<ChatEventInternal>] {
        if let Some(from) = self.get_index(index.incr()) {
            &self.events[from..]
        } else {
            &[]
        }
    }

    pub fn hydrate_message(&self, message: &MessageInternal, my_user_id: Option<UserId>) -> Message {
        Message {
            message_index: message.message_index,
            message_id: message.message_id,
            sender: message.sender,
            content: message.content.hydrate(my_user_id),
            replies_to: message.replies_to.clone(),
            reactions: message
                .reactions
                .iter()
                .map(|(r, u)| (r.clone(), u.iter().copied().collect()))
                .collect(),
            edited: message.last_updated.is_some(),
            forwarded: false,
        }
    }

    pub fn hydrate_updated_message(&self, message: &UpdatedMessageInternal) -> UpdatedMessage {
        UpdatedMessage {
            updated_by: message.updated_by,
            event_index: self
                .message_id_map
                .get(&message.message_id)
                .map_or(EventIndex::default(), |e| *e),
            message_id: message.message_id,
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
        let earliest_event_index: u32 = self.events.first().unwrap().index.into();
        let latest_event_index: u32 = self.events.last().unwrap().index.into();

        let from_event_index = max(min_visible_event_index.into(), earliest_event_index);
        let to_event_index = latest_event_index;

        let from_index = (from_event_index - earliest_event_index) as usize;
        let to_index = (to_event_index - earliest_event_index) as usize;

        let query = Query::parse(search_term);

        let mut matches: Vec<_> = self.events[from_index..=to_index]
            .iter()
            .filter_map(|e| match &e.event {
                ChatEventInternal::Message(m) => {
                    let mut document: Document = (&m.content).into();
                    document.set_age(now - e.timestamp);
                    match document.calculate_score(&query) {
                        0 => None,
                        n => Some((n, m)),
                    }
                }
                _ => None,
            })
            .collect();

        matches.sort_unstable_by(|m1, m2| m2.0.cmp(&m1.0));

        matches
            .iter()
            .take(max_results as usize)
            .map(|m| MessageMatch {
                chat_id: self.chat_id,
                message_index: m.1.message_index,
                sender: m.1.sender,
                content: m.1.content.hydrate(Some(my_user_id)),
                score: m.0,
            })
            .collect()
    }

    pub fn get_range(&self, from_event_index: EventIndex, to_event_index: EventIndex) -> &[EventWrapper<ChatEventInternal>] {
        if self.events.is_empty() || from_event_index > to_event_index {
            return &[];
        }

        let earliest_event_index: u32 = self.events.first().unwrap().index.into();
        let latest_event_index: u32 = self.events.last().unwrap().index.into();

        let from_event_index = max(from_event_index.into(), earliest_event_index);
        let to_event_index = min(to_event_index.into(), latest_event_index);

        if from_event_index > latest_event_index || to_event_index < earliest_event_index {
            return &[];
        }

        let from_index = (from_event_index - earliest_event_index) as usize;
        let to_index = (to_event_index - earliest_event_index) as usize;

        &self.events[from_index..=to_index]
    }

    pub fn get_by_index(&self, indexes: Vec<EventIndex>) -> Vec<&EventWrapper<ChatEventInternal>> {
        if self.events.is_empty() {
            return Vec::new();
        }

        let earliest_index: u32 = self.events.first().unwrap().index.into();

        let calc_index = |i: EventIndex| {
            let as_u32: u32 = i.into();
            (as_u32 - earliest_index) as usize
        };

        indexes
            .into_iter()
            .map(calc_index)
            .filter_map(|index| self.events.get(index))
            .collect()
    }

    pub fn from_index(
        &self,
        start: EventIndex,
        ascending: bool,
        max_messages: usize,
        max_events: usize,
        min_visible_event_index: EventIndex,
    ) -> Vec<&EventWrapper<ChatEventInternal>> {
        if let Some(index) = self.get_index(start) {
            let iter: Box<dyn Iterator<Item = &EventWrapper<ChatEventInternal>>> = if ascending {
                let range = &self.events[index..];
                Box::new(range.iter())
            } else {
                let range = &self.events[..=index];
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

    pub fn get_events_window(
        &self,
        mid_point: MessageIndex,
        max_messages: usize,
        max_events: usize,
        min_visible_event_index: EventIndex,
    ) -> Vec<&EventWrapper<ChatEventInternal>> {
        if let Some(&mid_point) = self.message_index_map.get(&mid_point) {
            if let Some(min_visible_event_index) = self.get_index(min_visible_event_index) {
                let mid_point: u32 = mid_point.into();
                let mid_point = mid_point as usize;
                if mid_point >= min_visible_event_index {
                    let mut forwards_iter = self.events[mid_point..].iter();
                    let mut backwards_iter = self.events[min_visible_event_index..mid_point].iter().rev();

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

    pub fn get_message_index(&self, message_id: MessageId) -> Option<MessageIndex> {
        if let Some(&event_index) = self.message_id_map.get(&message_id) {
            if let Some(event) = self.get(event_index) {
                if let ChatEventInternal::Message(message) = &event.event {
                    return Some(message.message_index);
                };
            }
        }
        None
    }

    pub fn hydrate_mention(&self, message_index: &MessageIndex) -> Option<Mention> {
        if let Some(&event_index) = self.message_index_map.get(message_index) {
            if let Some(event) = self.get(event_index) {
                if let ChatEventInternal::Message(message) = &event.event {
                    return Some(Mention {
                        message_id: message.message_id,
                        message_index: message.message_index,
                        event_index: event.index,
                        mentioned_by: message.sender,
                    });
                }
            }
        }

        None
    }

    pub fn affected_event_indexes_since(&self, since: TimestampMillis, max_results: usize) -> Vec<EventIndex> {
        let mut affected_events = HashSet::new();

        for EventWrapper { event, .. } in self.events.iter().rev().take_while(|e| e.timestamp > since) {
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

    pub fn metrics(&self) -> Metrics {
        let mut metrics = self.metrics.clone();
        metrics.last_active = self.last().timestamp;
        metrics.total_events = self.events.len() as u64;
        metrics
    }

    pub fn len(&self) -> usize {
        self.events.len()
    }

    pub fn is_empty(&self) -> bool {
        self.events.is_empty()
    }

    fn get_message_by_message_index_internal_mut(&mut self, message_index: MessageIndex) -> Option<&mut MessageInternal> {
        let event_index = *self.message_index_map.get(&message_index)?;
        self.get_message_internal_mut(event_index)
    }

    fn get_message_by_id_internal_mut(&mut self, message_id: MessageId) -> Option<&mut MessageInternal> {
        let event_index = *self.message_id_map.get(&message_id)?;
        self.get_message_internal_mut(event_index)
    }

    fn get_message_internal_mut(&mut self, event_index: EventIndex) -> Option<&mut MessageInternal> {
        let event = self.get_mut(event_index)?;
        if let ChatEventInternal::Message(message) = &mut event.event {
            Some(message)
        } else {
            None
        }
    }

    fn get_index(&self, event_index: EventIndex) -> Option<usize> {
        if let Some(first_event) = self.events.first() {
            let earliest_event_index: u32 = first_event.index.into();
            let as_u32: u32 = event_index.into();
            let index = (as_u32 - earliest_event_index) as usize;
            if index < self.events.len() {
                return Some(index);
            }
        }

        None
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
        let mid_point = 10.into();

        let results = events.get_events_window(mid_point, 10, 40, EventIndex::default());

        assert_eq!(
            results
                .iter()
                .filter(|e| matches!(e.event, ChatEventInternal::Message(_)))
                .count(),
            10
        );

        let event_indexes: Vec<u32> = results.iter().map(|e| e.index.into()).collect();

        let mid_point_index = results.iter().position(|e| {
            if let ChatEventInternal::Message(m) = &e.event {
                m.message_index == mid_point
            } else {
                false
            }
        });

        assert_eq!(mid_point_index.unwrap(), results.len() / 2);
        assert!(event_indexes.into_iter().eq(11u32..=30));
    }

    #[test]
    fn get_events_window_event_limit() {
        let events = setup_events();
        let mid_point = 10.into();

        let results = events.get_events_window(mid_point, 15, 25, EventIndex::default());

        assert_eq!(results.len(), 25);

        let event_indexes: Vec<u32> = results.iter().map(|e| e.index.into()).collect();

        let mid_point_index = results.iter().position(|e| {
            if let ChatEventInternal::Message(m) = &e.event {
                m.message_index == mid_point
            } else {
                false
            }
        });

        assert_eq!(mid_point_index.unwrap(), results.len() / 2);
        assert!(event_indexes.into_iter().eq(9u32..=33));
    }

    #[test]
    fn get_events_window_min_visible_event_index() {
        let events = setup_events();
        let mid_point = 10.into();

        let results = events.get_events_window(mid_point, 10, 40, 18.into());

        assert_eq!(
            results
                .iter()
                .filter(|e| matches!(e.event, ChatEventInternal::Message(_)))
                .count(),
            10
        );

        let event_indexes: Vec<u32> = results.iter().map(|e| e.index.into()).collect();

        let mid_point_index = results.iter().position(|e| {
            if let ChatEventInternal::Message(m) = &e.event {
                m.message_index == mid_point
            } else {
                false
            }
        });

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
