use direct_chat_core::{DirectChatUserState, Participant};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::ChatId;

// One user's entry for a direct chat: their own state for the chat, plus which core holds its
// events and which of the core's two positions is theirs. The cores live outside of any user, in
// the `DirectChatCores` held by the canister, since a chat between two users of this canister has
// a single core shared by both of their entries.
#[derive(Serialize, Deserialize)]
pub struct UserDirectChat {
    pub key_id: u32,
    pub me: Participant,
    pub state: DirectChatUserState,
}

// The direct chats of one user, keyed by the other user's id as in the User canister
#[derive(Serialize, Deserialize, Default)]
pub struct UserDirectChats {
    chats: HashMap<ChatId, UserDirectChat>,
}

impl UserDirectChats {
    pub fn get(&self, chat_id: &ChatId) -> Option<&UserDirectChat> {
        self.chats.get(chat_id)
    }

    pub fn get_mut(&mut self, chat_id: &ChatId) -> Option<&mut UserDirectChat> {
        self.chats.get_mut(chat_id)
    }

    // Panics if the user already has a chat with the same user, since replacing the entry would
    // leave that chat's core with nothing pointing at it
    pub fn add(&mut self, chat: UserDirectChat) {
        let chat_id = chat.state.them.into();
        assert!(self.chats.insert(chat_id, chat).is_none(), "Direct chat already exists");
    }

    pub fn remove(&mut self, chat_id: &ChatId) -> Option<UserDirectChat> {
        self.chats.remove(chat_id)
    }
}
