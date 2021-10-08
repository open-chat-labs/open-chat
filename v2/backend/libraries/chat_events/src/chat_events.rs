use candid::CandidType;
use search::*;
use serde::Deserialize;
use std::cmp::{max, min};
use std::collections::hash_map::Entry::Vacant;
use std::collections::{HashMap, HashSet};
use types::*;

#[derive(CandidType, Deserialize)]
pub struct ChatEvents {
    chat_type: ChatType,
    chat_id: ChatId,
    events: Vec<EventWrapper<ChatEventInternal>>,
    message_id_map: HashMap<MessageId, EventIndex>,
    latest_message_event_index: Option<EventIndex>,
    latest_message_index: Option<MessageIndex>,
}

#[derive(CandidType, Deserialize)]
enum ChatType {
    Direct,
    Group,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum ChatEventInternal {
    Message(Box<MessageInternal>),
    MessageEdited(Box<MessageId>),
    MessageDeleted(Box<MessageId>),
    MessageReactionAdded(Box<MessageId>),
    MessageReactionRemoved(Box<MessageId>),
    DirectChatCreated(DirectChatCreated),
    GroupChatCreated(Box<GroupChatCreated>),
    GroupNameChanged(Box<GroupNameChanged>),
    GroupDescriptionChanged(Box<GroupDescriptionChanged>),
    AvatarChanged(Box<AvatarChanged>),
    ParticipantsAdded(Box<ParticipantsAdded>),
    ParticipantsRemoved(Box<ParticipantsRemoved>),
    ParticipantJoined(Box<ParticipantJoined>),
    ParticipantLeft(Box<ParticipantLeft>),
    ParticipantsPromotedToAdmin(Box<ParticipantsPromotedToAdmin>),
    ParticipantsDismissedAsAdmin(Box<ParticipantsDismissedAsAdmin>),
    UsersBlocked(Box<UsersBlocked>),
    UsersUnblocked(Box<UsersUnblocked>),
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
                | ChatEventInternal::ParticipantsAdded(_)
                | ChatEventInternal::ParticipantsRemoved(_)
                | ChatEventInternal::ParticipantJoined(_)
                | ChatEventInternal::ParticipantLeft(_)
                | ChatEventInternal::ParticipantsPromotedToAdmin(_)
                | ChatEventInternal::ParticipantsDismissedAsAdmin(_)
                | ChatEventInternal::UsersBlocked(_)
                | ChatEventInternal::UsersUnblocked(_)
        )
    }
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct MessageInternal {
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sender: UserId,
    pub content: MessageContent,
    pub replies_to: Option<ReplyContext>,
    pub reactions: Vec<(Reaction, HashSet<UserId>)>,
    pub last_updated: Option<TimestampMillis>,
}

pub struct PushMessageArgs {
    pub sender: UserId,
    pub message_id: MessageId,
    pub content: MessageContent,
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
    Success,
    AlreadyDeleted,
    NotAuthorized,
    NotFound,
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
            events: Vec::new(),
            message_id_map: HashMap::new(),
            latest_message_event_index: None,
            latest_message_index: None,
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
            latest_message_event_index: None,
            latest_message_index: None,
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

    pub fn push_message(&mut self, args: PushMessageArgs) -> (EventIndex, Message) {
        let message_index = self.next_message_index();
        let message_internal = MessageInternal {
            message_index,
            message_id: args.message_id,
            sender: args.sender,
            content: args.content,
            replies_to: args.replies_to,
            reactions: Vec::new(),
            last_updated: None,
        };
        let message = self.hydrate_message(&message_internal);
        let event_index = self.push_event(ChatEventInternal::Message(Box::new(message_internal)), args.now);
        (event_index, message)
    }

    pub fn push_event(&mut self, event: ChatEventInternal, now: TimestampMillis) -> EventIndex {
        let valid = match self.chat_type {
            ChatType::Direct => event.is_valid_for_direct_chat(),
            ChatType::Group => event.is_valid_for_group_chat(),
        };

        if !valid {
            panic!("Event type is not valid: {:?}", event);
        }

        let event_index = self.events.last().map_or(EventIndex::default(), |e| e.index.incr());
        if let ChatEventInternal::Message(m) = &event {
            match self.message_id_map.entry(m.message_id) {
                Vacant(e) => e.insert(event_index),
                _ => panic!("MessageId already used: {:?}", m.message_id),
            };
            self.latest_message_index = Some(m.message_index);
            self.latest_message_event_index = Some(event_index);
        }
        self.events.push(EventWrapper {
            index: event_index,
            timestamp: now,
            event,
        });
        event_index
    }

    pub fn edit_message(&mut self, args: EditMessageArgs) -> EditMessageResult {
        if let Some(message) = self.get_message_internal_mut(args.message_id) {
            if message.sender == args.sender {
                if matches!(message.content, MessageContent::Deleted) {
                    EditMessageResult::NotFound
                } else {
                    message.content = args.content;
                    message.last_updated = Some(args.now);
                    self.push_event(ChatEventInternal::MessageEdited(Box::new(args.message_id)), args.now);
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
        if let Some(message) = self.get_message_internal_mut(message_id) {
            if message.sender == caller || is_admin {
                if matches!(message.content, MessageContent::Deleted) {
                    DeleteMessageResult::AlreadyDeleted
                } else {
                    message.content = MessageContent::Deleted;
                    message.last_updated = Some(now);
                    self.push_event(ChatEventInternal::MessageDeleted(Box::new(message_id)), now);
                    DeleteMessageResult::Success
                }
            } else {
                DeleteMessageResult::NotAuthorized
            }
        } else {
            DeleteMessageResult::NotFound
        }
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
            panic!("Invalid reaction: {:?}", reaction);
        }

        if let Some(&event_index) = self.message_id_map.get(&message_id) {
            if let Some(ChatEventInternal::Message(message)) = self.get_internal_mut(event_index).map(|e| &mut e.event) {
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
                    let new_event_index = self.push_event(ChatEventInternal::MessageReactionAdded(Box::new(message_id)), now);
                    ToggleReactionResult::Added(new_event_index)
                } else {
                    let new_event_index = self.push_event(ChatEventInternal::MessageReactionRemoved(Box::new(message_id)), now);
                    ToggleReactionResult::Removed(new_event_index)
                };
            }
        }

        ToggleReactionResult::MessageNotFound
    }

    pub fn reaction_exists(&self, added_by: UserId, message_id: &MessageId, reaction: &Reaction) -> bool {
        if let Some(&event_index) = self.message_id_map.get(message_id) {
            if let Some(ChatEventInternal::Message(message)) = self.get_internal(event_index).map(|e| &e.event) {
                if let Some((_, users)) = message.reactions.iter().find(|(r, _)| r == reaction) {
                    return users.contains(&added_by);
                }
            }
        }
        false
    }

    pub fn latest_message(&self) -> Option<EventWrapper<Message>> {
        self.latest_message_if_updated(0)
    }

    pub fn latest_message_if_updated(&self, since: TimestampMillis) -> Option<EventWrapper<Message>> {
        let event_index = self.latest_message_event_index?;

        self.get_internal(event_index)
            .map(|e| {
                if let ChatEventInternal::Message(m) = &e.event {
                    if e.timestamp > since || m.last_updated.unwrap_or(0) > since {
                        return Some(EventWrapper {
                            index: e.index,
                            timestamp: e.timestamp,
                            event: self.hydrate_message(m),
                        });
                    }
                }
                None
            })
            .flatten()
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

    pub fn hydrate_message(&self, message: &MessageInternal) -> Message {
        Message {
            message_index: message.message_index,
            message_id: message.message_id,
            sender: message.sender,
            content: message.content.clone(),
            replies_to: message.replies_to.clone(),
            reactions: message
                .reactions
                .iter()
                .map(|(r, u)| (r.clone(), u.iter().copied().collect()))
                .collect(),
            edited: message.last_updated.is_some(),
        }
    }

    pub fn hydrate_updated_message(&self, message_id: MessageId) -> UpdatedMessage {
        UpdatedMessage {
            event_index: self.message_id_map.get(&message_id).map_or(EventIndex::default(), |e| *e),
            message_id,
        }
    }

    pub fn search_messages(
        &self,
        now: TimestampMillis,
        min_visible_event_index: EventIndex,
        search_term: &str,
        max_results: u8,
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
                        n => Some((n, m, e.index)),
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
                event_index: m.2,
                sender: m.1.sender,
                content: m.1.content.clone(),
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
        max_messages: u32,
        max_events: u32,
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
            let mut messages_count: u32 = 0;
            for event in iter
                .take_while(|e| e.index >= min_visible_event_index)
                .take(max_events as usize)
            {
                let is_message = matches!(event.event, ChatEventInternal::Message(_));

                events.push(event);

                if is_message {
                    messages_count += 1;
                    if messages_count == max_messages {
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

    pub fn get_message_index(&self, message_id: MessageId) -> Option<MessageIndex> {
        if let Some(&event_index) = self.message_id_map.get(&message_id) {
            if let Some(event) = self.get_internal(event_index) {
                if let ChatEventInternal::Message(message) = &event.event {
                    return Some(message.message_index);
                };
            }
        }
        None
    }

    fn get_internal(&self, event_index: EventIndex) -> Option<&EventWrapper<ChatEventInternal>> {
        let index = self.get_index(event_index)?;

        self.events.get(index)
    }

    fn get_internal_mut(&mut self, event_index: EventIndex) -> Option<&mut EventWrapper<ChatEventInternal>> {
        let index = self.get_index(event_index)?;

        self.events.get_mut(index)
    }

    fn get_message_internal_mut(&mut self, message_id: MessageId) -> Option<&mut MessageInternal> {
        if let Some(&event_index) = self.message_id_map.get(&message_id) {
            if let Some(event) = self.get_internal_mut(event_index) {
                if let ChatEventInternal::Message(message) = &mut event.event {
                    return Some(message);
                };
            }
        }
        None
    }

    fn get_index(&self, event_index: EventIndex) -> Option<usize> {
        if let Some(first_event) = self.events.first() {
            let earliest_event_index: u32 = first_event.index.into();
            let as_u32: u32 = event_index.into();
            let index = (as_u32 - earliest_event_index) as usize;
            Some(index)
        } else {
            None
        }
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
        assert_eq!(results.first().unwrap().index, 10.into());
        assert_eq!(results.last().unwrap().index, 29.into());
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
        assert_eq!(results.first().unwrap().index, 21.into());
        assert_eq!(results.last().unwrap().index, 40.into());
    }

    #[test]
    fn from_index_event_limit() {
        let events = setup_events();

        let results = events.from_index(10.into(), true, 15, 25, EventIndex::default());

        assert_eq!(results.len(), 25);
        assert_eq!(results.first().unwrap().index, 10.into());
        assert_eq!(results.last().unwrap().index, 34.into());
    }

    #[test]
    fn from_index_event_limit_rev() {
        let events = setup_events();

        let results = events.from_index(40.into(), false, 15, 25, EventIndex::default());

        assert_eq!(results.len(), 25);
        assert_eq!(results.first().unwrap().index, 16.into());
        assert_eq!(results.last().unwrap().index, 40.into());
    }

    fn setup_events() -> ChatEvents {
        let user_id = Principal::from_slice(&[1]).into();

        let mut events = ChatEvents::new_direct_chat(Principal::from_slice(&[2]).into(), 1);

        for i in 2..50 {
            let message_id = i.into();
            events.push_message(PushMessageArgs {
                sender: user_id,
                message_id,
                content: MessageContent::Text(TextContent {
                    text: "hello".to_owned(),
                }),
                replies_to: None,
                now: i as u64,
            });
            events.push_event(ChatEventInternal::MessageReactionAdded(Box::new(message_id)), i as u64);
        }

        events
    }
}
