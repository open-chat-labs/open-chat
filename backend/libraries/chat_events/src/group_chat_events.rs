use crate::chat_events::ChatEvents;
use crate::types::ChatEventInternal;
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::ops::{Deref, DerefMut};
use types::{ChatId, EventIndex, EventWrapper, GroupChatEvent, TimestampMillis, UserId};

#[derive(Serialize, Deserialize)]
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

    fn hydrate_event(
        &self,
        event: &EventWrapper<ChatEventInternal>,
        my_user_id: Option<UserId>,
    ) -> EventWrapper<GroupChatEvent> {
        let event_data = match &event.event {
            ChatEventInternal::Message(m) => GroupChatEvent::Message(Box::new(self.inner.hydrate_message(m, my_user_id))),
            ChatEventInternal::MessageEdited(m) => GroupChatEvent::MessageEdited(self.inner.hydrate_updated_message(m)),
            ChatEventInternal::MessageDeleted(m) => GroupChatEvent::MessageDeleted(self.inner.hydrate_updated_message(m)),
            ChatEventInternal::MessageReactionAdded(m) => {
                GroupChatEvent::MessageReactionAdded(self.inner.hydrate_updated_message(m))
            }
            ChatEventInternal::MessageReactionRemoved(m) => {
                GroupChatEvent::MessageReactionRemoved(self.inner.hydrate_updated_message(m))
            }
            ChatEventInternal::GroupChatCreated(g) => GroupChatEvent::GroupChatCreated(*g.clone()),
            ChatEventInternal::GroupNameChanged(g) => GroupChatEvent::GroupNameChanged(*g.clone()),
            ChatEventInternal::GroupDescriptionChanged(g) => GroupChatEvent::GroupDescriptionChanged(*g.clone()),
            ChatEventInternal::AvatarChanged(g) => GroupChatEvent::AvatarChanged(*g.clone()),
            ChatEventInternal::OwnershipTransferred(e) => GroupChatEvent::OwnershipTransferred(*e.clone()),
            ChatEventInternal::ParticipantsAdded(p) => GroupChatEvent::ParticipantsAdded(*p.clone()),
            ChatEventInternal::ParticipantsRemoved(p) => GroupChatEvent::ParticipantsRemoved(*p.clone()),
            ChatEventInternal::ParticipantJoined(p) => GroupChatEvent::ParticipantJoined(*p.clone()),
            ChatEventInternal::ParticipantLeft(p) => GroupChatEvent::ParticipantLeft(*p.clone()),
            ChatEventInternal::ParticipantAssumesSuperAdmin(p) => GroupChatEvent::ParticipantAssumesSuperAdmin(*p.clone()),
            ChatEventInternal::ParticipantRelinquishesSuperAdmin(p) => {
                GroupChatEvent::ParticipantRelinquishesSuperAdmin(*p.clone())
            }
            ChatEventInternal::ParticipantDismissedAsSuperAdmin(p) => {
                GroupChatEvent::ParticipantDismissedAsSuperAdmin(*p.clone())
            }
            ChatEventInternal::RoleChanged(r) => GroupChatEvent::RoleChanged(*r.clone()),
            ChatEventInternal::UsersBlocked(u) => GroupChatEvent::UsersBlocked(*u.clone()),
            ChatEventInternal::UsersUnblocked(u) => GroupChatEvent::UsersUnblocked(*u.clone()),
            ChatEventInternal::MessagePinned(p) => GroupChatEvent::MessagePinned(*p.clone()),
            ChatEventInternal::PermissionsChanged(p) => GroupChatEvent::PermissionsChanged(*p.clone()),
            ChatEventInternal::MessageUnpinned(u) => GroupChatEvent::MessageUnpinned(*u.clone()),
            ChatEventInternal::PollVoteRegistered(v) => {
                GroupChatEvent::PollVoteRegistered(self.inner.hydrate_poll_vote_registered(v))
            }
            ChatEventInternal::PollVoteDeleted(v) => GroupChatEvent::PollVoteDeleted(self.inner.hydrate_updated_message(v)),
            ChatEventInternal::PollEnded(m) => GroupChatEvent::PollEnded(self.inner.hydrate_poll_ended(**m)),
            ChatEventInternal::GroupVisibilityChanged(g) => GroupChatEvent::GroupVisibilityChanged(*g.clone()),
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
