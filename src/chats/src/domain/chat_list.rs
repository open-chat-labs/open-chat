use std::collections::{HashMap, hash_map::Entry::{Occupied, Vacant}};
use ic_types::Principal;
use shared::StableState;
use super::chat::Chat;

#[derive(Default)]
pub struct ChatList {
    chats: HashMap<(Principal, Principal), Chat>
}

impl ChatList {
    pub fn get(&self, sender: Principal, recipient: Principal) -> Option<&Chat> {
        let (user1, user2) = ChatList::order_users(sender, recipient);

        self.chats.get(&(user1, user2))
    }

    pub fn get_or_add_chat(&mut self, sender: Principal, recipient: Principal) -> &mut Chat {
        let (user1, user2) = ChatList::order_users(sender, recipient);

        match self.chats.entry((user1.clone(), user2.clone())) {
            Occupied(e) => e.into_mut(),
            Vacant(e) => e.insert(Chat::new(user1, user2))
        }
    }

    fn order_users(user1: Principal, user2: Principal) -> (Principal, Principal) {
        if user1 < user2 {
            (user1, user2)
        } else {
            (user2, user1)
        }
    }
}

impl StableState for ChatList {
    type State = Vec<Chat>;

    fn drain(self) -> Vec<Chat> {
        self.chats
            .into_iter()
            .map(|(_, v)| v)
            .collect()
    }

    fn fill(chats: Vec<Chat>) -> ChatList {
        let map: HashMap<(Principal, Principal), Chat> = chats
            .into_iter()
            .map(|c| ((c.get_key(), c)))
            .collect();
        
        ChatList {
            chats: map
        }
    }
}