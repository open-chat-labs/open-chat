use crate::model::direct_chat::DirectChat;
use chat_events::{ChatMetricsInternal, PushMessageArgs};
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::{ChatId, EventWrapper, Message, MessageIndex, TimestampMillis, Timestamped, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct DirectChats {
    direct_chats: HashMap<ChatId, DirectChat>,
    pinned: Timestamped<Vec<ChatId>>,
    metrics: ChatMetricsInternal,
}

impl DirectChats {
    // TODO remove this after next upgrade
    pub fn convert_sns_messages_to_icrc1(&mut self) {
        for chat in self.direct_chats.values_mut() {
            chat.events.convert_sns_messages_to_icrc1();
        }
    }

    pub fn get(&self, chat_id: &ChatId) -> Option<&DirectChat> {
        self.direct_chats.get(chat_id)
    }

    pub fn get_mut(&mut self, chat_id: &ChatId) -> Option<&mut DirectChat> {
        self.direct_chats.get_mut(chat_id)
    }

    pub fn updated_since(&self, since: TimestampMillis) -> impl Iterator<Item = &DirectChat> {
        self.direct_chats.values().filter(move |c| c.has_updates_since(since))
    }

    pub fn pinned(&self) -> &Vec<ChatId> {
        &self.pinned.value
    }

    pub fn pinned_if_updated(&self, since: TimestampMillis) -> Option<Vec<ChatId>> {
        self.pinned.if_set_after(since).map(|ids| ids.to_vec())
    }

    pub fn any_updated(&self, since: TimestampMillis) -> bool {
        self.direct_chats.values().any(|c| c.has_updates_since(since))
    }

    pub fn iter(&self) -> impl Iterator<Item = &DirectChat> {
        self.direct_chats.values()
    }

    pub fn len(&self) -> usize {
        self.direct_chats.len()
    }

    pub fn push_message(
        &mut self,
        sent_by_me: bool,
        their_user_id: UserId,
        their_message_index: Option<MessageIndex>,
        args: PushMessageArgs,
        is_bot: bool,
    ) -> EventWrapper<Message> {
        let chat_id = ChatId::from(their_user_id);
        let now = args.now;

        let chat: &mut DirectChat = match self.direct_chats.entry(chat_id) {
            Occupied(e) => e.into_mut(),
            Vacant(e) => e.insert(DirectChat::new(their_user_id, is_bot, None, args.now)),
        };

        let message_event = chat.events.push_message(args);

        chat.mark_read_up_to(message_event.event.message_index, sent_by_me, now);

        if !sent_by_me {
            if let Some(their_message_index) = their_message_index {
                chat.unread_message_index_map
                    .add(message_event.event.message_index, their_message_index);
            }
        }

        message_event
    }

    pub fn aggregate_metrics(&mut self) {
        let mut metrics = ChatMetricsInternal::default();

        for chat in self.direct_chats.values() {
            metrics.merge(chat.events.metrics());
        }

        self.metrics = metrics;
    }

    pub fn metrics(&self) -> &ChatMetricsInternal {
        &self.metrics
    }

    pub fn has(&self, chat_id: &ChatId) -> bool {
        self.direct_chats.contains_key(chat_id)
    }

    pub fn pin(&mut self, chat_id: ChatId, now: TimestampMillis) {
        if !self.pinned.value.contains(&chat_id) {
            self.pinned.timestamp = now;
            self.pinned.value.insert(0, chat_id);
        }
    }

    pub fn unpin(&mut self, chat_id: &ChatId, now: TimestampMillis) {
        if self.pinned.value.contains(chat_id) {
            self.pinned.timestamp = now;
            self.pinned.value.retain(|pinned_chat_id| pinned_chat_id != chat_id);
        }
    }
}
