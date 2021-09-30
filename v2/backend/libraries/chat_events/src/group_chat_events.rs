use crate::chat_events::{ChatEventInternal, ChatEvents};
use candid::CandidType;
use itertools::Itertools;
use serde::Deserialize;
use std::collections::HashSet;
use std::ops::{Deref, DerefMut};
use types::{ChatId, EventIndex, EventWrapper, GroupChatEvent, TimestampMillis, UserId};

#[derive(CandidType, Deserialize)]
pub struct GroupChatEvents {
    inner: ChatEvents,
}

impl GroupChatEvents {
    pub fn new(
        chat_id: ChatId,
        name: String,
        description: String,
        created_by: UserId,
        now: TimestampMillis,
    ) -> GroupChatEvents {
        let events = ChatEvents::new_group_chat(chat_id, name, description, created_by, now);

        GroupChatEvents { inner: events }
    }

    generate_common_methods!(GroupChatEvent);

    fn hydrate_event(&self, event: &EventWrapper<ChatEventInternal>) -> EventWrapper<GroupChatEvent> {
        let event_data = match &event.event {
            ChatEventInternal::Message(m) => GroupChatEvent::Message(self.inner.hydrate_message(m)),
            ChatEventInternal::MessageEdited(m) => GroupChatEvent::MessageEdited(self.inner.hydrate_updated_message(**m)),
            ChatEventInternal::MessageDeleted(m) => GroupChatEvent::MessageDeleted(self.inner.hydrate_updated_message(**m)),
            ChatEventInternal::MessageReactionAdded(m) => {
                GroupChatEvent::MessageReactionAdded(self.inner.hydrate_updated_message(**m))
            }
            ChatEventInternal::MessageReactionRemoved(m) => {
                GroupChatEvent::MessageReactionRemoved(self.inner.hydrate_updated_message(**m))
            }
            ChatEventInternal::GroupChatCreated(g) => GroupChatEvent::GroupChatCreated(*g.clone()),
            ChatEventInternal::GroupNameChanged(g) => GroupChatEvent::GroupNameChanged(*g.clone()),
            ChatEventInternal::GroupDescriptionChanged(g) => GroupChatEvent::GroupDescriptionChanged(*g.clone()),
            ChatEventInternal::AvatarChanged(g) => GroupChatEvent::AvatarChanged(*g.clone()),
            ChatEventInternal::ParticipantsAdded(p) => GroupChatEvent::ParticipantsAdded(*p.clone()),
            ChatEventInternal::ParticipantsRemoved(p) => GroupChatEvent::ParticipantsRemoved(*p.clone()),
            ChatEventInternal::ParticipantJoined(p) => GroupChatEvent::ParticipantJoined(*p.clone()),
            ChatEventInternal::ParticipantLeft(p) => GroupChatEvent::ParticipantLeft(*p.clone()),
            ChatEventInternal::ParticipantsPromotedToAdmin(p) => GroupChatEvent::ParticipantsPromotedToAdmin(*p.clone()),
            ChatEventInternal::ParticipantsDismissedAsAdmin(p) => GroupChatEvent::ParticipantsDismissedAsAdmin(*p.clone()),
            ChatEventInternal::UsersBlocked(u) => GroupChatEvent::UsersBlocked(*u.clone()),
            ChatEventInternal::UsersUnblocked(u) => GroupChatEvent::UsersUnblocked(*u.clone()),
            _ => panic!("Unrecognised event type"),
        };

        EventWrapper {
            index: event.index,
            timestamp: event.timestamp,
            event: event_data,
        }
    }
}

impl Deref for GroupChatEvents {
    type Target = ChatEvents;

    fn deref(&self) -> &Self::Target {
        &self.inner
    }
}

impl DerefMut for GroupChatEvents {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.inner
    }
}
