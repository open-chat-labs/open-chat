use crate::model::direct_chat::DirectChat;
use crate::model::events::PushMessageArgs;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::{ChatId, EventIndex, Message, MessageIndex, TimestampMillis, UserId};

pub struct DirectChats {
    my_user_id: UserId,
    direct_chats: HashMap<ChatId, DirectChat>,
}

impl DirectChats {
    pub fn new(my_user_id: UserId) -> DirectChats {
        DirectChats {
            my_user_id,
            direct_chats: HashMap::new(),
        }
    }

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

    pub fn get_all_mut(&mut self) -> impl Iterator<Item = &mut DirectChat> {
        self.direct_chats.values_mut()
    }

    pub fn exists(&self, user_id: UserId) -> bool {
        self.direct_chats.contains_key(&user_id.into())
    }

    pub fn push_message(
        &mut self,
        their_user_id: UserId,
        their_message_index: Option<MessageIndex>,
        args: PushMessageArgs,
    ) -> (ChatId, EventIndex, Message) {
        let chat_id = ChatId::from(their_user_id);
        let sent_by_me = args.sent_by_me;
        let now = args.now;

        let chat: &mut DirectChat = match self.direct_chats.entry(chat_id) {
            Occupied(e) => e.into_mut(),
            Vacant(e) => e.insert(DirectChat::new(self.my_user_id, their_user_id, args.now)),
        };

        let (event_index, message) = chat.events.push_message(args);

        if sent_by_me {
            chat.read_by_me.insert(message.message_index.into());
            chat.read_by_me_updated = now;
        } else {
            chat.read_by_them.insert(message.message_index.into());
            chat.read_by_them_updated = now;
            if let Some(their_message_index) = their_message_index {
                chat.unread_message_index_map.add(message.message_index, their_message_index);
            }
        }

        (chat_id, event_index, message)
    }
}
