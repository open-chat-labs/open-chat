use crate::model::direct_chat::DirectChat;
use crate::model::events::PushMessageArgs;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::{ChatId, DirectMessage, EventIndex, TimestampMillis, UserId};

#[derive(Default)]
pub struct DirectChats {
    direct_chats: HashMap<ChatId, DirectChat>,
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

    pub fn push_message(&mut self, their_user_id: UserId, args: PushMessageArgs) -> (ChatId, EventIndex, DirectMessage) {
        let chat_id = ChatId::from(their_user_id);

        let chat: &mut DirectChat = match self.direct_chats.entry(chat_id) {
            Occupied(e) => e.into_mut(),
            Vacant(e) => e.insert(DirectChat::new(chat_id, their_user_id, args.now)),
        };

        let (event_index, message) = chat.events.push_message(args);
        (chat_id, event_index, message)
    }
}
