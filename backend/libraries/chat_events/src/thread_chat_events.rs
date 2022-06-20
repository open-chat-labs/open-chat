use crate::chat_events::ChatEvents;
use crate::types::ChatEventInternal;
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::ops::{Deref, DerefMut};
use types::{ChatId, EventIndex, EventWrapper, ThreadChatEvent, UserId};

#[derive(Serialize, Deserialize)]
pub struct ThreadChatEvents {
    inner: ChatEvents,
}

impl ThreadChatEvents {
    pub fn new(chat_id: ChatId) -> Self {
        let events = ChatEvents::new_thread(chat_id);

        ThreadChatEvents { inner: events }
    }

    generate_common_methods!(ThreadChatEvent);

    fn hydrate_event(
        &self,
        event: &EventWrapper<ChatEventInternal>,
        my_user_id: Option<UserId>,
    ) -> EventWrapper<ThreadChatEvent> {
        let event_data = match &event.event {
            ChatEventInternal::Message(m) => ThreadChatEvent::Message(Box::new(self.inner.hydrate_message(m, my_user_id))),
            ChatEventInternal::MessageEdited(m) => ThreadChatEvent::MessageEdited(self.inner.hydrate_updated_message(m)),
            ChatEventInternal::MessageDeleted(m) => ThreadChatEvent::MessageDeleted(self.inner.hydrate_updated_message(m)),
            ChatEventInternal::MessageReactionAdded(m) => {
                ThreadChatEvent::MessageReactionAdded(self.inner.hydrate_updated_message(m))
            }
            ChatEventInternal::MessageReactionRemoved(m) => {
                ThreadChatEvent::MessageReactionRemoved(self.inner.hydrate_updated_message(m))
            }
            ChatEventInternal::PollVoteRegistered(v) => {
                ThreadChatEvent::PollVoteRegistered(self.inner.hydrate_poll_vote_registered(v))
            }
            ChatEventInternal::PollVoteDeleted(v) => ThreadChatEvent::PollVoteDeleted(self.inner.hydrate_updated_message(v)),
            ChatEventInternal::PollEnded(m) => ThreadChatEvent::PollEnded(self.inner.hydrate_poll_ended(**m)),
            _ => panic!("Unrecognised event type"),
        };

        EventWrapper {
            index: event.index,
            timestamp: event.timestamp,
            event: event_data,
        }
    }
}

impl Deref for ThreadChatEvents {
    type Target = ChatEvents;

    fn deref(&self) -> &Self::Target {
        &self.inner
    }
}

impl DerefMut for ThreadChatEvents {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.inner
    }
}
