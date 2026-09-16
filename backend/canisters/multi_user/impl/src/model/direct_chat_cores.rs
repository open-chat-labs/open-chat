use crate::model::user_direct_chats::UserDirectChat;
use direct_chat_core::{DirectChat, DirectChatCore, DirectChatMut, DirectChatRef};
use serde::{Deserialize, Serialize};
use stable_memory_map::{KeyScope, with_key_scope};
use std::collections::BTreeMap;

// The core of every direct chat held by the canister, keyed by the chat's `key_id`. A chat between
// two users of this canister has a single core shared by both of their entries, so the cores sit
// outside of any user and their stable memory map entries (the events) are keyed under the
// canister rather than under a user. Every access to a core therefore runs within the canister's
// key scope, whichever user's scope it is reached from.
#[derive(Serialize, Deserialize)]
pub struct DirectChatCores {
    cores: BTreeMap<u32, DirectChatCore>,
    next_key_id: u32,
}

impl Default for DirectChatCores {
    fn default() -> DirectChatCores {
        DirectChatCores {
            cores: BTreeMap::new(),
            // Key ids start from 1 as they do in the User canister
            next_key_id: 1,
        }
    }
}

impl DirectChatCores {
    // Adds the core built by `f` for the next key id, which is returned. `f` runs within the
    // canister's key scope since creating a chat's events writes to the stable memory map.
    pub fn add(&mut self, f: impl FnOnce(u32) -> DirectChatCore) -> u32 {
        let key_id = self.next_key_id;
        self.next_key_id += 1;
        let core = with_key_scope(KeyScope::Canister, || f(key_id));
        self.cores.insert(key_id, core);
        key_id
    }

    // Views the chat from the side of the user whose entry `chat` is. A user's entry is only ever
    // created alongside its core, so a missing core is a bug rather than a condition to handle.
    pub fn with_chat<R>(&self, chat: &UserDirectChat, f: impl FnOnce(DirectChatRef) -> R) -> R {
        let core = self.cores.get(&chat.key_id).expect("Direct chat core not found");
        with_key_scope(KeyScope::Canister, || f(DirectChat::borrowed(chat.me, &chat.state, core)))
    }

    pub fn with_chat_mut<R>(&mut self, chat: &mut UserDirectChat, f: impl FnOnce(DirectChatMut) -> R) -> R {
        let core = self.cores.get_mut(&chat.key_id).expect("Direct chat core not found");
        with_key_scope(KeyScope::Canister, || {
            f(DirectChat::borrowed_mut(chat.me, &mut chat.state, core))
        })
    }

    pub fn len(&self) -> usize {
        self.cores.len()
    }
}
