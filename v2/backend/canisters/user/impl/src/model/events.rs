use candid::CandidType;
use serde::Deserialize;
use std::cmp::{max, min};
use types::*;

pub struct Events {
    events: Vec<EventWrapper<DirectChatEventInternal>>,
    latest_message_event_index: EventIndex,
    latest_message_index: MessageIndex,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum DirectChatEventInternal {
    Message(MessageInternal),
    DirectChatCreated(DirectChatCreated),
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct MessageInternal {
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sent_by_me: bool,
    pub content: MessageContent,
    pub replies_to: Option<DirectReplyContextInternal>,
}

pub struct PushMessageArgs {
    pub sent_by_me: bool,
    pub message_id: MessageId,
    pub content: MessageContent,
    pub replies_to: Option<DirectReplyContextInternal>,
    pub now: TimestampMillis,
}

impl Events {
    pub fn new(now: TimestampMillis) -> Events {
        let mut events = Events {
            events: Vec::new(),
            latest_message_event_index: EventIndex::default(),
            latest_message_index: MessageIndex::default(),
        };

        events.push_event(DirectChatEventInternal::DirectChatCreated(DirectChatCreated {}), now);

        events
    }

    pub fn push_message(&mut self, args: PushMessageArgs) -> (EventIndex, DirectMessage) {
        let message_index = self.latest_message_index.incr();
        let message_internal = MessageInternal {
            message_index,
            message_id: args.message_id,
            sent_by_me: args.sent_by_me,
            content: args.content,
            replies_to: args.replies_to,
        };
        let message = self.hydrate_message(&message_internal);
        let event_index = self.push_event(DirectChatEventInternal::Message(message_internal), args.now);
        (event_index, message)
    }

    pub fn push_event(&mut self, event: DirectChatEventInternal, now: TimestampMillis) -> EventIndex {
        let event_index = self.events.last().map_or(EventIndex::default(), |e| e.index.incr());
        if let DirectChatEventInternal::Message(m) = &event {
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

    pub fn get(&self, event_index: EventIndex) -> Option<EventWrapper<DirectChatEvent>> {
        self.get_internal(event_index).map(|e| self.hydrate_event(e))
    }

    pub fn get_range(&self, from_event_index: EventIndex, to_event_index: EventIndex) -> Vec<EventWrapper<DirectChatEvent>> {
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

    pub fn get_by_index(&self, indexes: Vec<EventIndex>) -> Vec<EventWrapper<DirectChatEvent>> {
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

    pub fn latest_message(&self) -> Option<EventWrapper<DirectMessage>> {
        self.get_internal(self.latest_message_event_index)
            .map(|e| {
                if let DirectChatEventInternal::Message(m) = &e.event {
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

    pub fn last(&self) -> &EventWrapper<DirectChatEventInternal> {
        self.events.last().unwrap()
    }

    pub fn latest_message_index(&self) -> MessageIndex {
        self.latest_message_index
    }

    fn hydrate_event(&self, event: &EventWrapper<DirectChatEventInternal>) -> EventWrapper<DirectChatEvent> {
        let event_data = match &event.event {
            DirectChatEventInternal::Message(m) => DirectChatEvent::Message(self.hydrate_message(m)),
            DirectChatEventInternal::DirectChatCreated(d) => DirectChatEvent::DirectChatCreated(*d),
        };

        EventWrapper {
            index: event.index,
            timestamp: event.timestamp,
            event: event_data,
        }
    }

    fn hydrate_message(&self, message: &MessageInternal) -> DirectMessage {
        DirectMessage {
            message_index: message.message_index,
            message_id: message.message_id,
            sent_by_me: message.sent_by_me,
            content: message.content.clone(),
            replies_to: message.replies_to.as_ref().map(|i| self.hydrate_reply_context(i)).flatten(),
        }
    }

    fn hydrate_reply_context(&self, reply_context: &DirectReplyContextInternal) -> Option<DirectReplyContext> {
        if let Some(chat_id) = reply_context.chat_id_if_other {
            Some(DirectReplyContext::Private(PrivateReplyContext {
                chat_id,
                event_index: reply_context.event_index,
            }))
        } else {
            self.get_internal(reply_context.event_index)
                .map(|e| {
                    if let DirectChatEventInternal::Message(m) = &e.event {
                        Some(DirectReplyContext::Standard(StandardReplyContext {
                            event_index: e.index,
                            sent_by_me: m.sent_by_me,
                            content: m.content.clone(),
                        }))
                    } else {
                        None
                    }
                })
                .flatten()
        }
    }

    fn get_internal(&self, event_index: EventIndex) -> Option<&EventWrapper<DirectChatEventInternal>> {
        if self.events.is_empty() {
            return None;
        }

        let earliest_event_index: u32 = self.events.first().unwrap().index.into();
        let as_u32: u32 = event_index.into();
        let index = (as_u32 - earliest_event_index) as usize;

        self.events.get(index)
    }
}
