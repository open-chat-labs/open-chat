use crate::direct_chat::{DirectChat, DirectChatMut, DirectChatRef, DirectChatUserState};
use crate::direct_chat_core::{DirectChatCore, Participant};
use serde::{Deserialize, Serialize};
use stable_memory_map::{BaseKeyPrefix, KeyScope, with_key_scope};
use std::collections::BTreeMap;
use types::{Milliseconds, TimestampMillis, UserId, UserType};

/// The cores of every direct chat held by a canister which holds many users, keyed by the chat's
/// `key_id`. A chat between two users of the canister has a single core shared by both of their
/// entries, so the cores sit outside of any user and their stable memory map entries (the events)
/// are keyed under the canister rather than under a user. Every access to a core therefore runs
/// within the canister's key scope, whichever user's scope it is reached from, which is also why
/// this collection can only be used in a canister whose stable memory map keys are scoped.
///
/// A core is only ever reached through a `DirectChat` viewing it from one user's side, so the
/// canister holding the cores never handles one directly.
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
    // Adds the core for a chat held by one user alone, who takes the first position in it, and
    // returns its key id
    pub fn add(
        &mut self,
        my_user_id: UserId,
        them: UserId,
        events_ttl: Option<Milliseconds>,
        anonymized_chat_id: u128,
        now: TimestampMillis,
    ) -> u32 {
        self.add_core(|key_id| DirectChatCore::new(my_user_id, them, key_id, events_ttl, anonymized_chat_id, now))
    }

    // Adds the core for a chat shared by two users of the canister and returns its key id. `second`
    // is the user taking the second position in it (see `DirectChatCore::new_shared`).
    pub fn add_shared(
        &mut self,
        second: UserId,
        events_ttl: Option<Milliseconds>,
        anonymized_chat_id: u128,
        now: TimestampMillis,
    ) -> u32 {
        self.add_core(|key_id| DirectChatCore::new_shared(second, key_id, events_ttl, anonymized_chat_id, now))
    }

    // `f` runs within the canister's key scope since creating a chat's events writes to the stable
    // memory map
    fn add_core(&mut self, f: impl FnOnce(u32) -> DirectChatCore) -> u32 {
        let key_id = self.next_key_id;
        self.next_key_id += 1;
        let core = with_key_scope(KeyScope::Canister, || f(key_id));
        self.cores.insert(key_id, core);
        key_id
    }

    // Builds the state for a user taking `position` in a core again after deleting their entry for
    // the chat while the other user kept theirs. The events so far stay hidden from the returned
    // state's view of the chat (see `DirectChatCore::rejoin`).
    pub fn rejoin(
        &mut self,
        key_id: u32,
        position: Participant,
        them: UserId,
        user_type: UserType,
        now: TimestampMillis,
    ) -> DirectChatUserState {
        let core = self.core_mut(key_id);
        let min_visible_event_index = with_key_scope(KeyScope::Canister, || core.rejoin(position, now));
        DirectChatUserState::new_with_min_visible_event_index(them, user_type, min_visible_event_index, now)
    }

    // Removes the core once no user's entry points at it any more, returning the stable memory
    // key prefixes its entries were written under so that they can be garbage collected
    pub fn remove(&mut self, key_id: u32) -> Vec<BaseKeyPrefix> {
        let core = self.cores.remove(&key_id).expect("Direct chat core not found");
        with_key_scope(KeyScope::Canister, || core.stable_memory_key_prefixes())
    }

    // Views the chat with the core `key_id` from the side of the user whose state and position in
    // the core are given. A user's entry is only ever created alongside its core, so a missing
    // core is a bug rather than a condition to handle.
    pub fn with_chat<R>(
        &self,
        key_id: u32,
        me: Participant,
        state: &DirectChatUserState,
        f: impl FnOnce(DirectChatRef) -> R,
    ) -> R {
        let core = self.cores.get(&key_id).expect("Direct chat core not found");
        with_key_scope(KeyScope::Canister, || f(DirectChat::borrowed(me, state, core)))
    }

    pub fn with_chat_mut<R>(
        &mut self,
        key_id: u32,
        me: Participant,
        state: &mut DirectChatUserState,
        f: impl FnOnce(DirectChatMut) -> R,
    ) -> R {
        let core = self.core_mut(key_id);
        with_key_scope(KeyScope::Canister, || f(DirectChat::borrowed_mut(me, state, core)))
    }

    pub fn len(&self) -> usize {
        self.cores.len()
    }

    pub fn is_empty(&self) -> bool {
        self.cores.is_empty()
    }

    fn core_mut(&mut self, key_id: u32) -> &mut DirectChatCore {
        self.cores.get_mut(&key_id).expect("Direct chat core not found")
    }
}
