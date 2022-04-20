use crate::chat_events::ChatEvents;
use crate::types::ChatEventInternal;
use candid::CandidType;
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::ops::{Deref, DerefMut};
use types::{DirectChatEvent, EventIndex, EventWrapper, MessageIndex, TimestampMillis, UserId};

#[derive(CandidType, Serialize, Deserialize)]
pub struct DirectChatEvents {
    inner: ChatEvents,
}

impl DirectChatEvents {
    pub fn new(them: UserId, now: TimestampMillis) -> Self {
        let events = ChatEvents::new_direct_chat(them, now);

        DirectChatEvents { inner: events }
    }

    generate_common_methods!(DirectChatEvent);

    fn hydrate_event(
        &self,
        event: &EventWrapper<ChatEventInternal>,
        my_user_id: Option<UserId>,
    ) -> EventWrapper<DirectChatEvent> {
        let event_data = match &event.event {
            ChatEventInternal::Message(m) => DirectChatEvent::Message(Box::new(self.inner.hydrate_message(m, my_user_id))),
            ChatEventInternal::MessageEdited(m) => DirectChatEvent::MessageEdited(self.inner.hydrate_updated_message(m)),
            ChatEventInternal::MessageDeleted(m) => DirectChatEvent::MessageDeleted(self.inner.hydrate_updated_message(m)),
            ChatEventInternal::MessageReactionAdded(m) => {
                DirectChatEvent::MessageReactionAdded(self.inner.hydrate_updated_message(m))
            }
            ChatEventInternal::MessageReactionRemoved(m) => {
                DirectChatEvent::MessageReactionRemoved(self.inner.hydrate_updated_message(m))
            }
            ChatEventInternal::DirectChatCreated(d) => DirectChatEvent::DirectChatCreated(*d),
            ChatEventInternal::PollVoteRegistered(v) => {
                DirectChatEvent::PollVoteRegistered(self.inner.hydrate_poll_vote_registered(v))
            }
            ChatEventInternal::PollVoteDeleted(v) => DirectChatEvent::PollVoteDeleted(self.inner.hydrate_updated_message(v)),
            ChatEventInternal::PollEnded(m) => DirectChatEvent::PollEnded(self.inner.hydrate_poll_ended(**m)),
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
