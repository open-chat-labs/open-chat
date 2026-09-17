use direct_chat_core::DirectChatEntry;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::ChatId;

// The direct chats of one user, keyed by the other user's id as in the User canister. Each is the
// user's entry for the chat, whose core lives outside of any user in the `DirectChatCores` held by
// the canister, since a chat between two users of this canister has a single core shared by both
// of their entries.
#[derive(Serialize, Deserialize, Default)]
pub struct UserDirectChats {
    chats: HashMap<ChatId, DirectChatEntry>,
}

impl UserDirectChats {
    pub fn get(&self, chat_id: &ChatId) -> Option<&DirectChatEntry> {
        self.chats.get(chat_id)
    }

    pub fn get_mut(&mut self, chat_id: &ChatId) -> Option<&mut DirectChatEntry> {
        self.chats.get_mut(chat_id)
    }

    // Panics if the user already has a chat with the same user, since replacing the entry would
    // leave that chat's core with nothing pointing at it
    pub fn add(&mut self, chat: DirectChatEntry) {
        let chat_id = chat.them.into();
        assert!(self.chats.insert(chat_id, chat).is_none(), "Direct chat already exists");
    }

    pub fn remove(&mut self, chat_id: &ChatId) -> Option<DirectChatEntry> {
        self.chats.remove(chat_id)
    }
}
