use candid::CandidType;
use group_canister::send_message::GroupReplyContextArgs;
use search::*;
use serde::Deserialize;
use std::cmp::{max, min};
use std::collections::hash_map::Entry::Vacant;
use std::collections::{HashMap, HashSet};
use types::*;

pub struct Events {
    events: Vec<EventWrapper<GroupChatEventInternal>>,
    message_id_map: HashMap<MessageId, EventIndex>,
    latest_message_event_index: Option<EventIndex>,
    latest_message_index: Option<MessageIndex>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum GroupChatEventInternal {
    Message(Box<MessageInternal>),
    DeletedMessage(Box<DeletedGroupMessage>),
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
    MessageDeleted(Box<MessageId>),
    MessageReactionAdded(Box<MessageId>),
    MessageReactionRemoved(Box<MessageId>),
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct MessageInternal {
    message_index: MessageIndex,
    message_id: MessageId,
    sender: UserId,
    content: MessageContent,
    replies_to: Option<GroupReplyContextInternal>,
    reactions: Vec<(String, HashSet<UserId>)>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GroupReplyContextInternal {
    message_id: MessageId,
}

pub struct PushMessageArgs {
    pub sender: UserId,
    pub message_id: MessageId,
    pub content: MessageContent,
    pub replies_to: Option<GroupReplyContextArgs>,
    pub now: TimestampMillis,
}

pub enum DeleteMessageResult {
    Success,
    AlreadyDeleted,
    NotAuthorized,
    NotFound,
}

pub enum ToggleReactionResult {
    Added,
    Removed,
    MessageNotFound,
}

impl Events {
    pub fn new(name: String, description: String, created_by: UserId, now: TimestampMillis) -> Events {
        let mut events = Events {
            events: Vec::new(),
            message_id_map: HashMap::new(),
            latest_message_event_index: None,
            latest_message_index: None,
        };

        events.push_event(
            GroupChatEventInternal::GroupChatCreated(Box::new(GroupChatCreated {
                name,
                description,
                created_by,
            })),
            now,
        );

        events
    }

    pub fn push_message(&mut self, args: PushMessageArgs) -> (EventIndex, GroupMessage) {
        let message_index = self.next_message_index();
        let message_internal = MessageInternal {
            message_index,
            message_id: args.message_id,
            sender: args.sender,
            content: args.content,
            replies_to: args.replies_to.map(|r| GroupReplyContextInternal {
                message_id: r.message_id,
            }),
            reactions: Vec::new(),
        };
        let message = self.hydrate_message(&message_internal);
        let event_index = self.push_event(GroupChatEventInternal::Message(Box::new(message_internal)), args.now);
        (event_index, message)
    }

    pub fn delete_message(&mut self, caller: UserId, message_id: MessageId, now: TimestampMillis) -> DeleteMessageResult {
        if let Some(&event_index) = self.message_id_map.get(&message_id) {
            if let Some(event) = self.get_internal(event_index) {
                let deleted_message = match &event.event {
                    GroupChatEventInternal::Message(message) => {
                        if message.sender == caller {
                            message.clone()
                        } else {
                            return DeleteMessageResult::NotAuthorized;
                        }
                    }
                    GroupChatEventInternal::DeletedMessage(_) => return DeleteMessageResult::AlreadyDeleted,
                    _ => return DeleteMessageResult::NotFound,
                };

                let deletion_event_index = self.push_event(GroupChatEventInternal::MessageDeleted(Box::new(message_id)), now);
                let event = self.get_internal_mut(event_index).unwrap();
                event.event = GroupChatEventInternal::DeletedMessage(Box::new(DeletedGroupMessage {
                    message_index: deleted_message.message_index,
                    message_id: deleted_message.message_id,
                    sender: deleted_message.sender,
                    deletion_event_index,
                }))
            }
        }

        DeleteMessageResult::NotFound
    }

    pub fn push_event(&mut self, event: GroupChatEventInternal, now: TimestampMillis) -> EventIndex {
        let event_index = self.events.last().map_or(EventIndex::default(), |e| e.index.incr());
        if let GroupChatEventInternal::Message(m) = &event {
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

    pub fn toggle_reaction(
        &mut self,
        user_id: UserId,
        message_id: MessageId,
        reaction: String,
        now: TimestampMillis,
    ) -> ToggleReactionResult {
        if let Some(&event_index) = self.message_id_map.get(&message_id) {
            if let Some(GroupChatEventInternal::Message(message)) = self.get_internal_mut(event_index).map(|e| &mut e.event) {
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
                    self.push_event(GroupChatEventInternal::MessageReactionAdded(Box::new(message_id)), now);
                    ToggleReactionResult::Added
                } else {
                    self.push_event(GroupChatEventInternal::MessageReactionRemoved(Box::new(message_id)), now);
                    ToggleReactionResult::Removed
                };
            }
        }

        ToggleReactionResult::MessageNotFound
    }

    pub fn get(&self, event_index: EventIndex) -> Option<EventWrapper<GroupChatEvent>> {
        self.get_internal(event_index).map(|e| self.hydrate_event(e))
    }

    pub fn get_range(&self, from_event_index: EventIndex, to_event_index: EventIndex) -> Vec<EventWrapper<GroupChatEvent>> {
        if self.events.is_empty() {
            return Vec::new();
        }

        let earliest_event_index: u32 = self.events.first().unwrap().index.into();
        let latest_event_index: u32 = self.events.last().unwrap().index.into();

        let from_event_index = max(from_event_index.into(), earliest_event_index);
        let to_event_index = min(to_event_index.into(), latest_event_index);

        if from_event_index > latest_event_index || to_event_index < earliest_event_index {
            return Vec::new();
        }

        let from_index = (from_event_index - earliest_event_index) as usize;
        let to_index = (to_event_index - earliest_event_index) as usize;

        self.events[from_index..=to_index]
            .iter()
            .map(|e| self.hydrate_event(e))
            .collect()
    }

    pub fn get_by_index(&self, indexes: Vec<EventIndex>) -> Vec<EventWrapper<GroupChatEvent>> {
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
            .map(|e| self.hydrate_event(e))
            .collect()
    }

    pub fn latest_message(&self) -> Option<EventWrapper<GroupMessage>> {
        let event_index = self.latest_message_event_index?;

        self.get_internal(event_index)
            .map(|e| {
                if let GroupChatEventInternal::Message(m) = &e.event {
                    Some(EventWrapper {
                        index: e.index,
                        timestamp: e.timestamp,
                        event: self.hydrate_message(m),
                    })
                } else {
                    None
                }
            })
            .flatten()
    }

    pub fn last(&self) -> &EventWrapper<GroupChatEventInternal> {
        self.events.last().unwrap()
    }

    pub fn latest_message_index(&self) -> Option<MessageIndex> {
        self.latest_message_index
    }

    pub fn next_message_index(&self) -> MessageIndex {
        self.latest_message_index.map_or(MessageIndex::default(), |m| m.incr())
    }

    pub fn iter(&self) -> impl DoubleEndedIterator<Item = &EventWrapper<GroupChatEventInternal>> {
        self.events.iter()
    }

    pub fn from_index(
        &self,
        start: EventIndex,
        ascending: bool,
        max_messages: u32,
        max_events: u32,
    ) -> Vec<EventWrapper<GroupChatEvent>> {
        if let Some(index) = self.get_index(start) {
            let iter = self.events.iter().skip(index);
            let iter: Box<dyn Iterator<Item = &EventWrapper<GroupChatEventInternal>>> =
                if ascending { Box::new(iter) } else { Box::new(iter.rev()) };

            let mut events = Vec::new();
            let mut messages_count: u32 = 0;
            for event in iter.take(max_events as usize).map(|e| self.hydrate_event(e)) {
                let is_message = matches!(event.event, GroupChatEvent::Message(_));

                events.push(event);

                if is_message {
                    messages_count += 1;
                    if messages_count == max_messages {
                        break;
                    }
                }
            }

            events
        } else {
            Vec::new()
        }
    }

    pub fn hydrate_message(&self, message: &MessageInternal) -> GroupMessage {
        GroupMessage {
            message_index: message.message_index,
            message_id: message.message_id,
            sender: message.sender,
            content: message.content.clone(),
            replies_to: message.replies_to.as_ref().map(|i| self.hydrate_reply_context(i)).flatten(),
            reactions: message
                .reactions
                .iter()
                .map(|(r, u)| (r.clone(), u.iter().copied().collect()))
                .collect(),
        }
    }

    pub fn search_messages(
        &self,
        now: TimestampMillis,
        min_visible_event_index: EventIndex,
        search_term: &str,
        max_results: u8,
    ) -> Vec<GroupMessageMatch> {
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
                GroupChatEventInternal::Message(m) => {
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
            .map(|m| GroupMessageMatch {
                event_index: m.2,
                sender: m.1.sender,
                content: m.1.content.clone(),
                score: m.0,
            })
            .collect()
    }

    fn hydrate_event(&self, event: &EventWrapper<GroupChatEventInternal>) -> EventWrapper<GroupChatEvent> {
        let event_data = match &event.event {
            GroupChatEventInternal::Message(m) => GroupChatEvent::Message(self.hydrate_message(m)),
            GroupChatEventInternal::DeletedMessage(d) => GroupChatEvent::DeletedMessage(*d.clone()),
            GroupChatEventInternal::GroupChatCreated(g) => GroupChatEvent::GroupChatCreated(*g.clone()),
            GroupChatEventInternal::GroupNameChanged(g) => GroupChatEvent::GroupNameChanged(*g.clone()),
            GroupChatEventInternal::GroupDescriptionChanged(g) => GroupChatEvent::GroupDescriptionChanged(*g.clone()),
            GroupChatEventInternal::AvatarChanged(g) => GroupChatEvent::AvatarChanged(*g.clone()),
            GroupChatEventInternal::ParticipantsAdded(p) => GroupChatEvent::ParticipantsAdded(*p.clone()),
            GroupChatEventInternal::ParticipantsRemoved(p) => GroupChatEvent::ParticipantsRemoved(*p.clone()),
            GroupChatEventInternal::ParticipantJoined(p) => GroupChatEvent::ParticipantJoined(*p.clone()),
            GroupChatEventInternal::ParticipantLeft(p) => GroupChatEvent::ParticipantLeft(*p.clone()),
            GroupChatEventInternal::ParticipantsPromotedToAdmin(p) => GroupChatEvent::ParticipantsPromotedToAdmin(*p.clone()),
            GroupChatEventInternal::ParticipantsDismissedAsAdmin(p) => GroupChatEvent::ParticipantsDismissedAsAdmin(*p.clone()),
            GroupChatEventInternal::UsersBlocked(u) => GroupChatEvent::UsersBlocked(*u.clone()),
            GroupChatEventInternal::UsersUnblocked(u) => GroupChatEvent::UsersUnblocked(*u.clone()),
            GroupChatEventInternal::MessageDeleted(m) => GroupChatEvent::MessageDeleted(self.hydrate_updated_message(**m)),
            GroupChatEventInternal::MessageReactionAdded(m) => {
                GroupChatEvent::MessageReactionAdded(self.hydrate_updated_message(**m))
            }
            GroupChatEventInternal::MessageReactionRemoved(m) => {
                GroupChatEvent::MessageReactionRemoved(self.hydrate_updated_message(**m))
            }
        };

        EventWrapper {
            index: event.index,
            timestamp: event.timestamp,
            event: event_data,
        }
    }

    fn hydrate_reply_context(&self, reply_context: &GroupReplyContextInternal) -> Option<GroupReplyContext> {
        let event_index = *self.message_id_map.get(&reply_context.message_id)?;
        self.get_internal(event_index)
            .map(|e| {
                if let GroupChatEventInternal::Message(m) = &e.event {
                    Some(GroupReplyContext {
                        event_index,
                        message_id: reply_context.message_id,
                        user_id: m.sender,
                        content: m.content.clone(),
                    })
                } else {
                    None
                }
            })
            .flatten()
    }

    fn hydrate_updated_message(&self, message_id: MessageId) -> UpdatedMessage {
        UpdatedMessage {
            event_index: self.message_id_map.get(&message_id).map_or(EventIndex::default(), |e| *e),
            message_id,
        }
    }

    fn get_internal(&self, event_index: EventIndex) -> Option<&EventWrapper<GroupChatEventInternal>> {
        let index = self.get_index(event_index)?;

        self.events.get(index)
    }

    fn get_internal_mut(&mut self, event_index: EventIndex) -> Option<&mut EventWrapper<GroupChatEventInternal>> {
        let index = self.get_index(event_index)?;

        self.events.get_mut(index)
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
    use std::mem::size_of;

    #[test]
    fn enum_size() {
        let size = size_of::<GroupChatEventInternal>();
        assert_eq!(size, 16);
    }
}
