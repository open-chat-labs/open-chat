use candid::CandidType;
use serde::Deserialize;
use std::cmp::{max, min};
use types::events::*;
use types::message::GroupMessage;
use types::message_content::MessageContent;
use types::reply_context::{GroupReplyContext, GroupReplyContextInternal};
use types::{EventIndex, EventWrapper, MessageId, MessageIndex, TimestampMillis, UserId};

#[derive(Default)]
pub struct Events {
    events: Vec<EventWrapper<GroupChatEventInternal>>,
    latest_message_event_index: EventIndex,
    latest_message_index: MessageIndex,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum GroupChatEventInternal {
    Message(MessageInternal),
    GroupChatCreated(GroupChatCreated),
    GroupNameChanged(GroupNameChanged),
    GroupDescriptionChanged(GroupDescriptionChanged),
    ParticipantsAdded(ParticipantsAdded),
    ParticipantsRemoved(ParticipantsRemoved),
    ParticipantJoined(ParticipantJoined),
    ParticipantLeft(ParticipantLeft),
    ParticipantsPromotedToAdmin(ParticipantsPromotedToAdmin),
    ParticipantsDismissedAsAdmin(ParticipantsPromotedToAdmin),
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct MessageInternal {
    message_index: MessageIndex,
    message_id: MessageId,
    sender: UserId,
    content: MessageContent,
    replies_to: Option<GroupReplyContextInternal>,
}

pub struct PushMessageArgs {
    pub sender: UserId,
    pub message_id: MessageId,
    pub content: MessageContent,
    pub replies_to: Option<GroupReplyContextInternal>,
    pub now: TimestampMillis,
}

impl Events {
    pub fn push_message(&mut self, args: PushMessageArgs) -> (EventIndex, GroupMessage) {
        let message_index = self.latest_message_index.incr();
        let message_internal = MessageInternal {
            message_index,
            message_id: args.message_id,
            sender: args.sender,
            content: args.content,
            replies_to: args.replies_to,
        };
        let message = self.hydrate_message(&message_internal);
        let event_index = self.push_event(GroupChatEventInternal::Message(message_internal), args.now);
        (event_index, message)
    }

    pub fn push_event(&mut self, event: GroupChatEventInternal, now: TimestampMillis) -> EventIndex {
        let event_index = self.latest_event_index().incr();
        if let GroupChatEventInternal::Message(m) = &event {
            self.latest_message_index = m.message_index;
            self.latest_message_event_index = event_index;
        }
        self.events.push(EventWrapper {
            index: event_index,
            timestamp: now,
            event,
        });
        event_index
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
        self.get_internal(self.latest_message_event_index)
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

    pub fn last(&self) -> Option<&EventWrapper<GroupChatEventInternal>> {
        self.events.last()
    }

    pub fn latest_event_index(&self) -> EventIndex {
        self.events.last().map_or(EventIndex::default(), |e| e.index)
    }

    pub fn latest_message_index(&self) -> MessageIndex {
        self.latest_message_index
    }

    fn hydrate_event(&self, event: &EventWrapper<GroupChatEventInternal>) -> EventWrapper<GroupChatEvent> {
        let event_data = match &event.event {
            GroupChatEventInternal::Message(m) => GroupChatEvent::Message(self.hydrate_message(m)),
            GroupChatEventInternal::GroupChatCreated(g) => GroupChatEvent::GroupChatCreated(g.clone()),
            GroupChatEventInternal::GroupNameChanged(g) => GroupChatEvent::GroupNameChanged(g.clone()),
            GroupChatEventInternal::GroupDescriptionChanged(g) => GroupChatEvent::GroupDescriptionChanged(g.clone()),
            GroupChatEventInternal::ParticipantsAdded(p) => GroupChatEvent::ParticipantsAdded(p.clone()),
            GroupChatEventInternal::ParticipantsRemoved(p) => GroupChatEvent::ParticipantsRemoved(p.clone()),
            GroupChatEventInternal::ParticipantJoined(p) => GroupChatEvent::ParticipantJoined(p.clone()),
            GroupChatEventInternal::ParticipantLeft(p) => GroupChatEvent::ParticipantLeft(p.clone()),
            GroupChatEventInternal::ParticipantsPromotedToAdmin(p) => GroupChatEvent::ParticipantsPromotedToAdmin(p.clone()),
            GroupChatEventInternal::ParticipantsDismissedAsAdmin(p) => GroupChatEvent::ParticipantsDismissedAsAdmin(p.clone()),
        };

        EventWrapper {
            index: event.index,
            timestamp: event.timestamp,
            event: event_data,
        }
    }

    fn hydrate_message(&self, message: &MessageInternal) -> GroupMessage {
        GroupMessage {
            message_index: message.message_index,
            message_id: message.message_id,
            sender: message.sender,
            content: message.content.clone(),
            replies_to: message.replies_to.as_ref().map(|i| self.hydrate_reply_context(i)).flatten(),
        }
    }

    fn hydrate_reply_context(&self, reply_context: &GroupReplyContextInternal) -> Option<GroupReplyContext> {
        self.get_internal(reply_context.event_index)
            .map(|e| {
                if let GroupChatEventInternal::Message(m) = &e.event {
                    Some(GroupReplyContext {
                        event_index: reply_context.event_index,
                        user_id: m.sender,
                        content: m.content.clone(),
                    })
                } else {
                    None
                }
            })
            .flatten()
    }

    fn get_internal(&self, event_index: EventIndex) -> Option<&EventWrapper<GroupChatEventInternal>> {
        if self.events.is_empty() {
            return None;
        }

        let earliest_event_index: u32 = self.events.first().unwrap().index.into();
        let as_u32: u32 = event_index.into();
        let index = (as_u32 - earliest_event_index) as usize;

        self.events.get(index)
    }
}
