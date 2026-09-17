use crate::direct_chat::{DirectChat, DirectChatMut, DirectChatRef, DirectChatUserState};
use crate::direct_chat_core::{DirectChatCore, Participant};
use serde::{Deserialize, Serialize};
use stable_memory_map::{BaseKeyPrefix, KeyScope, with_key_scope};
use std::collections::BTreeMap;
use std::ops::{Deref, DerefMut};
use types::{EventIndex, Milliseconds, TimestampMillis, UserId, UserType};

/// One user's entry for a direct chat whose core is held in a `DirectChatCores`: their own state
/// for the chat, plus which core holds its events and which of the core's two positions is theirs.
/// An entry is only ever made by the `DirectChatCores` alongside the core it points at, and is how
/// the chat is reached again, via `with_chat` and `with_chat_mut`. The user's state is reachable
/// directly through `Deref`.
#[derive(Serialize, Deserialize)]
pub struct DirectChatEntry {
    key_id: u32,
    me: Participant,
    state: DirectChatUserState,
}

impl DirectChatEntry {
    pub fn key_id(&self) -> u32 {
        self.key_id
    }

    pub fn me(&self) -> Participant {
        self.me
    }
}

impl Deref for DirectChatEntry {
    type Target = DirectChatUserState;

    fn deref(&self) -> &DirectChatUserState {
        &self.state
    }
}

impl DerefMut for DirectChatEntry {
    fn deref_mut(&mut self) -> &mut DirectChatUserState {
        &mut self.state
    }
}

/// The cores of every direct chat held by a canister which holds many users, keyed by the chat's
/// `key_id`. A chat between two users of the canister has a single core shared by both of their
/// entries, so the cores sit outside of any user and their stable memory map entries (the events)
/// are keyed under the canister rather than under a user. Every access to a core therefore runs
/// within the canister's key scope, whichever user's scope it is reached from, which is also why
/// this collection can only be used in a canister whose stable memory map keys are scoped.
///
/// A core is only ever reached through a `DirectChat` viewing it from one user's side, so the
/// canister holding the cores never handles one directly: it holds each user's `DirectChatEntry`
/// for a chat, made here alongside the core, and views the chat through it.
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
    // Adds the core for a chat held by one user alone, whether with a user outside the canister or
    // with themselves, and returns their entry for it, in the first position
    pub fn add(
        &mut self,
        my_user_id: UserId,
        them: UserId,
        user_type: UserType,
        events_ttl: Option<Milliseconds>,
        anonymized_chat_id: u128,
        now: TimestampMillis,
    ) -> DirectChatEntry {
        let key_id = self.add_core(|key_id| DirectChatCore::new(my_user_id, them, key_id, events_ttl, anonymized_chat_id, now));
        DirectChatEntry {
            key_id,
            me: Participant::First,
            state: DirectChatUserState::new(them, user_type, my_user_id == them, EventIndex::default(), now),
        }
    }

    // Adds the core for a chat between two users of the canister, `a` and `b`, and returns their
    // entries for it in that order. `a` takes the first position in the core and `b` the second.
    pub fn add_shared(
        &mut self,
        a: UserId,
        b: UserId,
        events_ttl: Option<Milliseconds>,
        anonymized_chat_id: u128,
        now: TimestampMillis,
    ) -> (DirectChatEntry, DirectChatEntry) {
        let key_id = self.add_core(|key_id| DirectChatCore::new_shared(b, key_id, events_ttl, anonymized_chat_id, now));
        let entry = |me, them| DirectChatEntry {
            key_id,
            me,
            state: DirectChatUserState::new(them, UserType::User, false, EventIndex::default(), now),
        };
        (entry(Participant::First, b), entry(Participant::Second, a))
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

    // The entry for a user taking `position` in the core `key_id` again after deleting their entry
    // for the chat with `them`, who kept theirs (in the other position). The events so far stay
    // hidden from the returned entry's view of the chat (see `DirectChatCore::rejoin`).
    pub fn rejoin(&mut self, key_id: u32, position: Participant, them: UserId, now: TimestampMillis) -> DirectChatEntry {
        let core = self.core_mut(key_id);
        let min_visible_event_index = with_key_scope(KeyScope::Canister, || core.rejoin(position, now));
        DirectChatEntry {
            key_id,
            me: position,
            state: DirectChatUserState::new(them, UserType::User, false, min_visible_event_index, now),
        }
    }

    // Removes the core the entry points at, once no other entry points at it, returning the stable
    // memory key prefixes its entries were written under so that they can be garbage collected
    pub fn remove(&mut self, entry: DirectChatEntry) -> Vec<BaseKeyPrefix> {
        let core = self.cores.remove(&entry.key_id).expect("Direct chat core not found");
        with_key_scope(KeyScope::Canister, || core.stable_memory_key_prefixes())
    }

    // Views the chat from the side of the user whose entry is given. An entry is only ever created
    // alongside its core, so a missing core is a bug rather than a condition to handle.
    pub fn with_chat<R>(&self, entry: &DirectChatEntry, f: impl FnOnce(DirectChatRef) -> R) -> R {
        let core = self.cores.get(&entry.key_id).expect("Direct chat core not found");
        with_key_scope(KeyScope::Canister, || f(DirectChat::borrowed(entry.me, &entry.state, core)))
    }

    pub fn with_chat_mut<R>(&mut self, entry: &mut DirectChatEntry, f: impl FnOnce(DirectChatMut) -> R) -> R {
        let core = self.cores.get_mut(&entry.key_id).expect("Direct chat core not found");
        with_key_scope(KeyScope::Canister, || {
            f(DirectChat::borrowed_mut(entry.me, &mut entry.state, core))
        })
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
