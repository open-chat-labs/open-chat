use crate::model::direct_chat::DirectChat;
use candid::CandidType;
use chat_events::{Metrics, PushMessageArgs};
use serde::Deserialize;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::{ChatId, EventIndex, Message, MessageIndex, TimestampMillis, UserId};

#[derive(CandidType, Deserialize, Default)]
pub struct DirectChats {
    direct_chats: HashMap<ChatId, DirectChat>,
    metrics: Metrics,
}

impl DirectChats {
    pub fn get(&self, chat_id: &ChatId) -> Option<&DirectChat> {
        self.direct_chats.get(chat_id)
    }

    pub fn get_mut(&mut self, chat_id: &ChatId) -> Option<&mut DirectChat> {
        self.direct_chats.get_mut(chat_id)
    }

    pub fn get_all(&self, updated_since: Option<TimestampMillis>) -> impl Iterator<Item = &DirectChat> {
        self.direct_chats.values().filter(move |&c| {
            if let Some(updated_since) = updated_since {
                c.last_updated() > updated_since
            } else {
                true
            }
        })
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
    ) -> (ChatId, EventIndex, Message) {
        let chat_id = ChatId::from(their_user_id);
        let now = args.now;

        let chat: &mut DirectChat = match self.direct_chats.entry(chat_id) {
            Occupied(e) => e.into_mut(),
            Vacant(e) => e.insert(DirectChat::new(their_user_id, args.now)),
        };

        let (event_index, message) = chat.events.push_message(args);

        if sent_by_me {
            if chat.read_by_me.value.insert(message.message_index.into()) {
                chat.read_by_me.timestamp = now;
            }
        } else {
            if chat.read_by_them.value.insert(message.message_index.into()) {
                chat.read_by_them.timestamp = now;
            }
            if let Some(their_message_index) = their_message_index {
                chat.unread_message_index_map.add(message.message_index, their_message_index);
            }
        }

        (chat_id, event_index, message)
    }

    pub fn aggregate_metrics(&mut self) {
        let mut metrics = Metrics::default();

        for chat in self.direct_chats.values() {
            let chat_metrics = chat.events.metrics();
            metrics.text_messages += chat_metrics.text_messages;
            metrics.image_messages += chat_metrics.image_messages;
            metrics.video_messages += chat_metrics.video_messages;
            metrics.audio_messages += chat_metrics.audio_messages;
            metrics.file_messages += chat_metrics.file_messages;
            metrics.cycles_messages += chat_metrics.cycles_messages;
            metrics.deleted_messages += chat_metrics.deleted_messages;
            metrics.total_edits += chat_metrics.total_edits;
            metrics.replies += chat_metrics.replies;
            metrics.total_reactions += chat_metrics.total_reactions;
            metrics.total_events += chat_metrics.total_events;
            metrics.last_active = std::cmp::max(metrics.last_active, chat_metrics.last_active);
        }

        self.metrics = metrics;
    }

    pub fn metrics(&self) -> Metrics {
        self.metrics.clone()
    }
}
