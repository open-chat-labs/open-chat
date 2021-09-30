use crate::chat_events::{ChatEventInternal, ChatEvents};
use candid::CandidType;
use itertools::Itertools;
use serde::Deserialize;
use std::collections::HashSet;
use std::ops::{Deref, DerefMut};
use types::{DirectChatEvent, EventIndex, EventWrapper, TimestampMillis, UserId};

#[derive(CandidType, Deserialize)]
pub struct DirectChatEvents {
    inner: ChatEvents,
}

impl DirectChatEvents {
    pub fn new(them: UserId, now: TimestampMillis) -> Self {
        let events = ChatEvents::new_direct_chat(them, now);

        DirectChatEvents { inner: events }
    }

    generate_common_methods!(DirectChatEvent);

    fn hydrate_event(&self, event: &EventWrapper<ChatEventInternal>) -> EventWrapper<DirectChatEvent> {
        let event_data = match &event.event {
            ChatEventInternal::Message(m) => DirectChatEvent::Message(self.inner.hydrate_message(m)),
            ChatEventInternal::MessageEdited(m) => DirectChatEvent::MessageEdited(self.inner.hydrate_updated_message(**m)),
            ChatEventInternal::MessageDeleted(m) => DirectChatEvent::MessageDeleted(self.inner.hydrate_updated_message(**m)),
            ChatEventInternal::MessageReactionAdded(m) => {
                DirectChatEvent::MessageReactionAdded(self.inner.hydrate_updated_message(**m))
            }
            ChatEventInternal::MessageReactionRemoved(m) => {
                DirectChatEvent::MessageReactionRemoved(self.inner.hydrate_updated_message(**m))
            }
            ChatEventInternal::DirectChatCreated(d) => DirectChatEvent::DirectChatCreated(*d),
            _ => panic!("Unrecognised event type"),
        };

        EventWrapper {
            index: event.index,
            timestamp: event.timestamp,
            event: event_data,
        }
    }
}

impl Deref for DirectChatEvents {
    type Target = ChatEvents;

    fn deref(&self) -> &Self::Target {
        &self.inner
    }
}

impl DerefMut for DirectChatEvents {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.inner
    }
}
