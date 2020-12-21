use std::collections::{HashMap, hash_map::Entry::{Occupied, Vacant}};
use ic_cdk::export::candid::CandidType;
use ic_types::Principal;
use highway::{HighwayHasher, HighwayHash};
use serde::Deserialize;
use shared::StableState;
use super::chat::Chat;

#[derive(Default)]
pub struct ChatList {
    chats: HashMap<ChatId, Chat>
}

impl ChatList {

    pub fn create(&mut self, sender: Principal, recipient: Principal) -> Option<ChatId> {

        let chat_id = ChatId::new(&sender, &recipient);

        match self.chats.entry(chat_id) {
            Occupied(_) => None,
            Vacant(e) => {
                e.insert(Chat::new(sender, recipient));
                Some(chat_id)
            }
        }
    }

    pub fn get(&self, chat_id: ChatId, on_behalf_of: &Principal) -> Option<&Chat> {

        let chat = self.chats.get(&chat_id)?;

        if !chat.involves_user(on_behalf_of) {
            return None;
        }
    
        Some(chat)
    }

    pub fn get_mut(&mut self, chat_id: ChatId, on_behalf_of: &Principal) -> Option<&mut Chat> {

        let chat = self.chats.get_mut(&chat_id)?;

        if !chat.involves_user(on_behalf_of) {
            return None;
        }
    
        Some(chat)
    }
}

impl StableState for ChatList {
    type State = Vec<(ChatId, Chat)>;

    fn drain(self) -> Vec<(ChatId, Chat)> {
        self.chats
            .into_iter()
            .collect()
    }

    fn fill(chats: Vec<(ChatId, Chat)>) -> ChatList {
        let map: HashMap<ChatId, Chat> = chats
            .into_iter()
            .collect();
        
        ChatList {
            chats: map
        }
    }
}

/// TODO: We would preferably use a Uuid or u128 but these haven't yet got a CandidType implementation
#[derive(CandidType, Deserialize, PartialEq, Eq, Hash, Copy, Clone)]
pub struct ChatId(u64);

impl ChatId {
    fn new(user1: &Principal, user2: &Principal) -> ChatId {
        let mut hasher = HighwayHasher::default();

        if user1 < user2 {
            hasher.append(user1.as_slice());
            hasher.append(user2.as_slice());    
        } else {
            hasher.append(user2.as_slice());
            hasher.append(user1.as_slice());    
        }

        ChatId(hasher.finalize64())
    }
}

