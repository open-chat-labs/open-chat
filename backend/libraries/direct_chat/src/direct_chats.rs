use crate::direct_chat::DirectChat;
use crate::{private_replies, removed_chats};
use chat_events::{ChatInternal, ChatMetricsInternal};
use oc_error_codes::OCErrorCode;
use serde::{Deserialize, Serialize};
use stable_memory_map::{DirectChatKeyPrefix, KeyPrefix, RemovedChatKeyPrefix, with_map, with_map_mut};
use std::collections::HashMap;
use std::ops::{Deref, DerefMut};
use types::{Chat, ChatId, MessageIndex, TimestampMillis, Timestamped, UserId, UserType};
use utils::migrated_user_ids::MigratedUserIds;

// The user's direct chats, each of which is stored whole in the stable memory map, keyed by its
// `key_id`. The heap only holds a small entry per chat, from which the chats which have been updated
// or have events due to expire can be found without reading them.
//
// A chat is read from stable memory each time it is accessed. A chat accessed via `get_mut` is
// written back once the `DirectChatMut` is dropped, if it was changed.
#[derive(Serialize, Deserialize, Default)]
pub struct DirectChats {
    // Chats which haven't yet been moved into stable memory, which `migrate_to_stable_memory` moves
    // across. Only a User canister whose user was being migrated when it was upgraded can still have
    // any, since its user mustn't change until the migration completes or is cancelled, as can a user
    // imported from such a canister until their import completes. This can be removed once every
    // User canister has been upgraded with no migration in progress.
    #[serde(rename = "direct_chats", default, skip_serializing_if = "HashMap::is_empty")]
    on_heap: HashMap<ChatId, DirectChat>,
    #[serde(default)]
    in_stable_memory: HashMap<ChatId, DirectChatEntry>,
    pinned: Timestamped<HashMap<ChatId, TimestampMillis>>,
    // Each new direct chat is assigned the next value, which is used in place of the other user's
    // id in its stable memory keys, so that if a chat is deleted then recreated with the same user
    // the new chat's keys never collide with the old chat's (which may not yet have been garbage
    // collected)
    #[serde(default)]
    next_key_id: u32,
}

// What is kept on the heap for a chat stored in stable memory. Besides the chat's `key_id`, it
// holds the chat's `last_updated` and `next_event_expiry` as of when the chat was last written,
// which can only change when the chat is written.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
struct DirectChatEntry {
    #[serde(rename = "k")]
    key_id: u32,
    #[serde(rename = "u")]
    last_updated: TimestampMillis,
    #[serde(rename = "e", default, skip_serializing_if = "Option::is_none")]
    next_event_expiry: Option<TimestampMillis>,
}

impl DirectChatEntry {
    fn new(chat: &DirectChat) -> DirectChatEntry {
        DirectChatEntry {
            key_id: chat.key_id(),
            last_updated: chat.last_updated(),
            next_event_expiry: chat.events().next_event_expiry(),
        }
    }
}

impl DirectChats {
    pub fn get(&self, chat_id: &ChatId) -> Option<DirectChatRef<'_>> {
        if let Some(entry) = self.in_stable_memory.get(chat_id) {
            Some(DirectChatRef::read(entry))
        } else {
            self.on_heap.get(chat_id).map(DirectChatRef::on_heap)
        }
    }

    pub fn get_or_err(&self, chat_id: &ChatId) -> Result<DirectChatRef<'_>, OCErrorCode> {
        self.get(chat_id).ok_or(OCErrorCode::ChatNotFound)
    }

    pub fn get_mut(&mut self, chat_id: &ChatId) -> Option<DirectChatMut<'_>> {
        if let Some(entry) = self.in_stable_memory.get_mut(chat_id) {
            Some(DirectChatMut(DirectChatMutInner::InStableMemory {
                chat: Box::new(read_chat(entry.key_id)),
                entry,
                changed: false,
            }))
        } else {
            self.on_heap
                .get_mut(chat_id)
                .map(|chat| DirectChatMut(DirectChatMutInner::OnHeap(chat)))
        }
    }

    pub fn get_mut_or_err(&mut self, chat_id: &ChatId) -> Result<DirectChatMut<'_>, OCErrorCode> {
        self.get_mut(chat_id).ok_or(OCErrorCode::ChatNotFound)
    }

    pub fn get_or_create<F: FnOnce() -> u128>(
        &mut self,
        my_user_id: UserId,
        their_user_id: UserId,
        their_user_type: UserType,
        anonymized_id: F,
        now: TimestampMillis,
    ) -> DirectChatMut<'_> {
        let chat_id: ChatId = their_user_id.into();
        if self.exists(&chat_id) {
            return self.get_mut(&chat_id).unwrap();
        }

        self.next_key_id += 1;
        let chat = DirectChat::new(
            my_user_id,
            their_user_id,
            their_user_type,
            self.next_key_id,
            None,
            anonymized_id(),
            now,
        );
        let entry = self.in_stable_memory.entry(chat_id).or_insert(DirectChatEntry::new(&chat));
        // Marked as changed so that the new chat is written when the `DirectChatMut` is dropped
        DirectChatMut(DirectChatMutInner::InStableMemory {
            chat: Box::new(chat),
            entry,
            changed: true,
        })
    }

    pub fn updated_since(&self, since: TimestampMillis) -> impl Iterator<Item = DirectChatRef<'_>> {
        self.on_heap
            .values()
            .filter(move |chat| chat.has_updates_since(since))
            .map(DirectChatRef::on_heap)
            .chain(
                self.in_stable_memory
                    .values()
                    .filter(move |entry| entry.last_updated > since)
                    .map(DirectChatRef::read),
            )
    }

    pub fn removed_since(&self, since: TimestampMillis) -> Vec<ChatId> {
        removed_chats::removed_since(&RemovedChatKeyPrefix::new_for_direct_chats(), since)
            .into_iter()
            .map(|(_, chat_id)| chat_id.into())
            .collect()
    }

    pub fn pinned_chats(&self) -> HashMap<Chat, TimestampMillis> {
        self.pinned.value.iter().map(|(k, v)| (Chat::Direct(*k), *v)).collect()
    }

    pub fn pinned_chats_if_updated(&self, since: TimestampMillis) -> Option<HashMap<Chat, TimestampMillis>> {
        self.pinned
            .if_set_after(since)
            .map(|ids| ids.iter().map(|(k, v)| (Chat::Direct(*k), *v)).collect())
    }

    pub fn any_updated(&self, since: TimestampMillis) -> bool {
        self.on_heap.values().any(|c| c.has_updates_since(since))
            || self.in_stable_memory.values().any(|e| e.last_updated > since)
            || self.pinned.timestamp > since
            || removed_chats::any_removed_since(&RemovedChatKeyPrefix::new_for_direct_chats(), since)
    }

    // Every chat, each of which is read from stable memory as the iterator reaches it
    pub fn iter(&self) -> impl Iterator<Item = DirectChatRef<'_>> {
        self.on_heap
            .values()
            .map(DirectChatRef::on_heap)
            .chain(self.in_stable_memory.values().map(DirectChatRef::read))
    }

    pub fn len(&self) -> usize {
        self.on_heap.len() + self.in_stable_memory.len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn mark_private_reply(&mut self, user_id: UserId, chat: ChatInternal, message_index: MessageIndex) {
        if let ChatInternal::Group(chat_id) = chat {
            private_replies::add(chat_id, user_id, message_index);
        }
    }

    pub fn migrate_replies(&mut self, old: ChatInternal, new: ChatInternal, now: TimestampMillis) {
        if let ChatInternal::Group(chat_id) = old {
            // The replies are all read and removed up front, since updating each one writes to the
            // stable memory map
            for (user_id, message_index) in private_replies::take(chat_id) {
                if let Some(mut chat) = self.get_mut(&user_id.into()) {
                    chat.migrate_reply(message_index, old, new, now);
                }
            }
        }
    }

    // The metrics of every chat combined. This reads every chat, so is only for the canister's
    // metrics.
    pub fn metrics(&self) -> ChatMetricsInternal {
        let mut metrics = ChatMetricsInternal::default();
        for chat in self.iter() {
            metrics.merge(chat.events().metrics());
        }
        metrics
    }

    // The chats which have events due to expire by `now`
    pub fn chats_with_events_expiring_by(&self, now: TimestampMillis) -> Vec<ChatId> {
        let is_due = |expiry: Option<TimestampMillis>| expiry.is_some_and(|ts| ts <= now);

        self.on_heap
            .iter()
            .filter(|(_, chat)| is_due(chat.events().next_event_expiry()))
            .map(|(chat_id, _)| *chat_id)
            .chain(
                self.in_stable_memory
                    .iter()
                    .filter(|(_, entry)| is_due(entry.next_event_expiry))
                    .map(|(chat_id, _)| *chat_id),
            )
            .collect()
    }

    // When the next event due to expire in any of the chats expires
    pub fn next_event_expiry(&self) -> Option<TimestampMillis> {
        self.on_heap
            .values()
            .filter_map(|chat| chat.events().next_event_expiry())
            .chain(self.in_stable_memory.values().filter_map(|entry| entry.next_event_expiry))
            .min()
    }

    pub fn exists(&self, chat_id: &ChatId) -> bool {
        self.in_stable_memory.contains_key(chat_id) || self.on_heap.contains_key(chat_id)
    }

    pub fn pin(&mut self, chat_id: ChatId, now: TimestampMillis) {
        if !self.pinned.value.contains_key(&chat_id) {
            self.pinned.timestamp = now;
            self.pinned.value.insert(chat_id, now);
        }
    }

    pub fn unpin(&mut self, chat_id: &ChatId, now: TimestampMillis) {
        if self.pinned.value.contains_key(chat_id) {
            self.pinned.timestamp = now;
            self.pinned.value.remove(chat_id);
        }
    }

    // Moves the user's chats onto their new id, once they are migrated to a MultiUser canister. Their
    // chat with themselves is keyed by their id, so is moved to the new id, along with its pin.
    pub fn migrate_own_user_id(&mut self, old_user_id: UserId, new_user_id: UserId) {
        for chat in self.on_heap.values_mut() {
            chat.migrate_own_user_id(old_user_id, new_user_id);
        }
        for entry in self.in_stable_memory.values_mut() {
            let mut chat = read_chat(entry.key_id);
            chat.migrate_own_user_id(old_user_id, new_user_id);
            *entry = write_chat(&chat);
        }
        if let Some(chat) = self.on_heap.remove(&old_user_id.into()) {
            self.on_heap.insert(new_user_id.into(), chat);
        }
        if let Some(entry) = self.in_stable_memory.remove(&old_user_id.into()) {
            self.in_stable_memory.insert(new_user_id.into(), entry);
        }
        if let Some(pinned_at) = self.pinned.value.remove(&old_user_id.into()) {
            self.pinned.value.insert(new_user_id.into(), pinned_at);
        }
    }

    // Moves the chat with another user onto their new id, once they are migrated to a MultiUser
    // canister, along with its pin, so that events from them under their new id are added to it. The
    // chat under their old id is recorded as removed, so that clients drop it and pick it up under
    // the new id. If there is already a chat under the new id, eg. because a message from them under
    // it arrived first, both are left as they are. Returns whether the chat was moved.
    pub fn migrate_their_user_id(&mut self, old_user_id: UserId, new_user_id: UserId, now: TimestampMillis) -> bool {
        let old_chat_id: ChatId = old_user_id.into();
        let new_chat_id: ChatId = new_user_id.into();
        if self.exists(&new_chat_id) {
            return false;
        }
        if let Some(mut chat) = self.on_heap.remove(&old_chat_id) {
            chat.migrate_their_user_id(new_user_id, now);
            self.on_heap.insert(new_chat_id, chat);
        } else if let Some(entry) = self.in_stable_memory.remove(&old_chat_id) {
            let mut chat = read_chat(entry.key_id);
            chat.migrate_their_user_id(new_user_id, now);
            self.in_stable_memory.insert(new_chat_id, write_chat(&chat));
        } else {
            return false;
        }
        if let Some(pinned_at) = self.pinned.value.remove(&old_chat_id) {
            self.pinned.value.insert(new_chat_id, pinned_at);
            self.pinned.timestamp = now;
        }
        removed_chats::add(&RemovedChatKeyPrefix::new_for_direct_chats(), old_chat_id.into(), now);
        true
    }

    // The id of the other user in the chat recorded as being with `user_id`: `user_id` itself, or, if
    // the chat has since been moved onto their new id after they were migrated to a MultiUser
    // canister, that id. For what was recorded against the chat before it moved, such as timer jobs
    // and the locations of P2P swaps.
    pub fn latest_user_id(&self, user_id: UserId, migrated_user_ids: &MigratedUserIds) -> UserId {
        if self.exists(&user_id.into()) { user_id } else { migrated_user_ids.latest(user_id) }
    }

    pub fn remove(&mut self, chat_id: ChatId, now: TimestampMillis) -> Option<DirectChat> {
        let chat = if let Some(entry) = self.in_stable_memory.remove(&chat_id) {
            take_chat(entry.key_id)
        } else {
            self.on_heap.remove(&chat_id)?
        };
        removed_chats::add(&RemovedChatKeyPrefix::new_for_direct_chats(), chat_id.into(), now);
        Some(chat)
    }

    // Moves every chat still on the heap into stable memory, returning how many were moved
    pub fn migrate_to_stable_memory(&mut self) -> usize {
        if self.on_heap.is_empty() {
            return 0;
        }

        let mut chats: Vec<_> = std::mem::take(&mut self.on_heap).into_iter().collect();
        // Sorted by key, since `insert_many` is far cheaper when the entries are in key order
        chats.sort_unstable_by_key(|(_, chat)| chat.key_id());
        let prefix = DirectChatKeyPrefix::new();
        let entries: Vec<_> = chats
            .iter()
            .map(|(_, chat)| (prefix.create_key(&chat.key_id()), chat_to_bytes(chat)))
            .collect();
        with_map_mut(|m| m.insert_many(entries));

        let count = chats.len();
        for (chat_id, chat) in chats {
            self.in_stable_memory.insert(chat_id, DirectChatEntry::new(&chat));
        }
        count
    }
}

// A direct chat read from `DirectChats`
pub struct DirectChatRef<'a>(DirectChatRefInner<'a>);

enum DirectChatRefInner<'a> {
    OnHeap(&'a DirectChat),
    InStableMemory(Box<DirectChat>),
}

impl<'a> DirectChatRef<'a> {
    fn on_heap(chat: &'a DirectChat) -> Self {
        DirectChatRef(DirectChatRefInner::OnHeap(chat))
    }

    fn read(entry: &DirectChatEntry) -> Self {
        DirectChatRef(DirectChatRefInner::InStableMemory(Box::new(read_chat(entry.key_id))))
    }
}

impl Deref for DirectChatRef<'_> {
    type Target = DirectChat;

    fn deref(&self) -> &DirectChat {
        match &self.0 {
            DirectChatRefInner::OnHeap(chat) => chat,
            DirectChatRefInner::InStableMemory(chat) => chat,
        }
    }
}

// A direct chat borrowed mutably from `DirectChats`. A chat stored in stable memory is written back
// when this is dropped, if it was changed, which is taken to be whenever it was dereferenced mutably.
pub struct DirectChatMut<'a>(DirectChatMutInner<'a>);

enum DirectChatMutInner<'a> {
    OnHeap(&'a mut DirectChat),
    InStableMemory {
        chat: Box<DirectChat>,
        entry: &'a mut DirectChatEntry,
        changed: bool,
    },
}

impl Deref for DirectChatMut<'_> {
    type Target = DirectChat;

    fn deref(&self) -> &DirectChat {
        match &self.0 {
            DirectChatMutInner::OnHeap(chat) => chat,
            DirectChatMutInner::InStableMemory { chat, .. } => chat,
        }
    }
}

impl DerefMut for DirectChatMut<'_> {
    fn deref_mut(&mut self) -> &mut DirectChat {
        match &mut self.0 {
            DirectChatMutInner::OnHeap(chat) => chat,
            DirectChatMutInner::InStableMemory { chat, changed, .. } => {
                *changed = true;
                chat
            }
        }
    }
}

impl Drop for DirectChatMut<'_> {
    fn drop(&mut self) {
        // Nothing is written while unwinding from a panic, which in a canister would trap anyway
        if std::thread::panicking() {
            return;
        }
        if let DirectChatMutInner::InStableMemory {
            chat,
            entry,
            changed: true,
        } = &mut self.0
        {
            **entry = write_chat(chat);
        }
    }
}

fn read_chat(key_id: u32) -> DirectChat {
    let bytes = with_map(|m| m.get(DirectChatKeyPrefix::new().create_key(&key_id)))
        .unwrap_or_else(|| panic!("Direct chat with key_id {key_id} not found in stable memory"));
    bytes_to_chat(&bytes)
}

// Writes the chat to stable memory, returning its new entry
fn write_chat(chat: &DirectChat) -> DirectChatEntry {
    let entry = DirectChatEntry::new(chat);
    with_map_mut(|m| m.insert(DirectChatKeyPrefix::new().create_key(&entry.key_id), chat_to_bytes(chat)));
    entry
}

fn take_chat(key_id: u32) -> DirectChat {
    let bytes = with_map_mut(|m| m.remove(DirectChatKeyPrefix::new().create_key(&key_id)))
        .unwrap_or_else(|| panic!("Direct chat with key_id {key_id} not found in stable memory"));
    bytes_to_chat(&bytes)
}

fn chat_to_bytes(chat: &DirectChat) -> Vec<u8> {
    msgpack::serialize_then_unwrap(chat)
}

fn bytes_to_chat(bytes: &[u8]) -> DirectChat {
    msgpack::deserialize_then_unwrap(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use chat_events::{MessageContentInternal, NullEventPusher, PushMessageArgs, TextContentInternal};
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use stable_memory_map::{KeyScope, with_key_scope};
    use types::MessageId;

    #[test]
    fn chat_with_a_migrated_user_is_moved_onto_their_new_id() {
        init_stable_memory_map();
        let (me, old, new) = (user(1), user(2), user(3));
        let mut direct_chats = DirectChats::default();
        direct_chats.get_or_create(me, old, UserType::User, || 1, 10);
        direct_chats.pin(old.into(), 20);

        assert!(direct_chats.migrate_their_user_id(old, new, 100));

        let chat = direct_chats.get(&new.into()).unwrap();
        assert_eq!(chat.them, new);
        assert!(direct_chats.get(&old.into()).is_none());
        assert_eq!(
            direct_chats.pinned_chats(),
            HashMap::from([(types::Chat::Direct(new.into()), 20)])
        );
        // Clients which last synced before the move are sent the chat as a new one, and told the chat
        // under the old id was removed, while later ones hear of neither
        assert!(chat.added_since(99) && chat.has_updates_since(99));
        assert!(!chat.added_since(100) && !chat.has_updates_since(100));
        assert_eq!(direct_chats.removed_since(99), vec![ChatId::from(old)]);
        assert!(direct_chats.removed_since(100).is_empty());
        assert!(direct_chats.pinned_chats_if_updated(99).is_some());
        assert_eq!(updated_since(&direct_chats, 99), vec![new]);
        assert!(updated_since(&direct_chats, 100).is_empty());
    }

    #[test]
    fn chat_already_under_a_migrated_users_new_id_is_left_as_it_is() {
        init_stable_memory_map();
        let (me, old, new) = (user(1), user(2), user(3));
        let mut direct_chats = DirectChats::default();
        direct_chats.get_or_create(me, old, UserType::User, || 1, 10);
        direct_chats.get_or_create(me, new, UserType::User, || 2, 20);

        assert!(!direct_chats.migrate_their_user_id(old, new, 100));

        assert_eq!(direct_chats.get(&old.into()).unwrap().them, old);
        assert_eq!(direct_chats.get(&new.into()).unwrap().them, new);
        assert!(direct_chats.removed_since(0).is_empty());
        // Nor is anything done for a user there is no chat with
        assert!(!direct_chats.migrate_their_user_id(user(4), user(5), 100));
    }

    #[test]
    fn chats_are_stored_in_stable_memory_and_written_back_when_changed() {
        init_stable_memory_map();
        let (me, them) = (user(1), user(2));
        let mut direct_chats = DirectChats::default();

        direct_chats.get_or_create(me, them, UserType::User, || 1, 10);
        assert_eq!(chat_count_in_stable_memory(), 1);
        assert!(direct_chats.on_heap.is_empty());
        assert_eq!(direct_chats.len(), 1);
        assert!(direct_chats.exists(&them.into()));

        // A change is written back once the `DirectChatMut` is dropped, along with the chat's entry
        {
            let mut chat = direct_chats.get_mut(&them.into()).unwrap();
            chat.push_message::<NullEventPusher>(message(them, 1, 20), Some(0.into()), None);
            chat.notifications_muted = Timestamped::new(true, 30);
        }
        let chat = direct_chats.get(&them.into()).unwrap();
        assert!(chat.notifications_muted.value);
        assert_eq!(chat.main_events_reader().latest_message_index(), Some(0.into()));
        assert_eq!(chat.read_by_them_up_to().value, Some(0.into()));
        assert_eq!(chat.max_read_up_to_of_theirs(0.into()), Some(0.into()));
        assert_eq!(chat.last_updated(), 30);
        assert_eq!(entry(&direct_chats, them).last_updated, 30);
        assert!(direct_chats.any_updated(29));
        assert!(!direct_chats.any_updated(30));
        assert_eq!(updated_since(&direct_chats, 29), vec![them]);
        assert!(updated_since(&direct_chats, 30).is_empty());
        drop(chat);

        // A chat which is only read through a `DirectChatMut` isn't written back
        let written_before = stable_memory_bytes(&direct_chats, them);
        {
            let chat = direct_chats.get_mut(&them.into()).unwrap();
            assert!(chat.notifications_muted.value);
            with_map_mut(|m| m.insert(DirectChatKeyPrefix::new().create_key(&chat.key_id()), vec![1, 2, 3]));
        }
        assert_eq!(stable_memory_bytes(&direct_chats, them), vec![1, 2, 3]);
        with_map_mut(|m| m.insert(DirectChatKeyPrefix::new().create_key(&1), written_before));

        // The chat survives serializing the `DirectChats`, which only holds its entry
        let deserialized: DirectChats = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&direct_chats));
        assert_eq!(entry(&deserialized, them), entry(&direct_chats, them));
        assert!(deserialized.get(&them.into()).unwrap().notifications_muted.value);
    }

    #[test]
    fn removing_a_chat_removes_it_from_stable_memory() {
        init_stable_memory_map();
        let (me, them) = (user(1), user(2));
        let mut direct_chats = DirectChats::default();
        direct_chats.get_or_create(me, them, UserType::User, || 1, 10);

        let removed = direct_chats.remove(them.into(), 20).unwrap();
        assert_eq!(removed.them, them);
        assert_eq!(chat_count_in_stable_memory(), 0);
        assert!(!direct_chats.exists(&them.into()));
        assert!(direct_chats.get(&them.into()).is_none());
        assert_eq!(direct_chats.removed_since(10), vec![ChatId::from(them)]);
        assert!(direct_chats.remove(them.into(), 30).is_none());

        // A new chat with the same user is given a new key_id
        let chat = direct_chats.get_or_create(me, them, UserType::User, || 2, 40);
        assert_eq!(chat.key_id(), 2);
    }

    #[test]
    fn chats_on_the_heap_are_read_and_changed_until_moved_into_stable_memory() {
        init_stable_memory_map();
        let me = user(1);
        let mut direct_chats = legacy_direct_chats(me, &[user(2), user(3), user(4)]);
        let (on_heap, moved, created) = (user(2), user(3), user(5));

        // Chats on the heap are found, changed in place and included in every query
        assert_eq!(direct_chats.len(), 3);
        assert_eq!(chat_count_in_stable_memory(), 0);
        direct_chats.get_mut(&on_heap.into()).unwrap().archived = Timestamped::new(true, 50);
        assert!(direct_chats.get(&on_heap.into()).unwrap().archived.value);
        assert_eq!(updated_since(&direct_chats, 40), vec![on_heap]);
        assert_eq!(chat_count_in_stable_memory(), 0);

        // A new chat is put straight into stable memory, after the last key_id used on the heap
        assert_eq!(direct_chats.get_or_create(me, created, UserType::User, || 9, 60).key_id(), 4);
        assert_eq!(chat_count_in_stable_memory(), 1);
        assert_eq!(direct_chats.len(), 4);

        // Moving them into stable memory keeps everything about them
        let before = sorted_summaries(&direct_chats);
        assert!(direct_chats.migrate_their_user_id(moved, user(6), 70));
        assert_eq!(direct_chats.migrate_to_stable_memory(), 3);
        assert!(direct_chats.on_heap.is_empty());
        assert_eq!(chat_count_in_stable_memory(), 4);
        assert_eq!(direct_chats.migrate_to_stable_memory(), 0);
        let mut expected: Vec<_> = before
            .into_iter()
            .map(|(them, last_updated)| if them == moved { (user(6), 70) } else { (them, last_updated) })
            .collect();
        expected.sort();
        assert_eq!(sorted_summaries(&direct_chats), expected);
        assert!(direct_chats.get(&on_heap.into()).unwrap().archived.value);
        assert_eq!(updated_since(&direct_chats, 60), vec![user(6)]);
    }

    #[test]
    fn state_from_before_chats_were_in_stable_memory_is_read_as_on_the_heap() {
        init_stable_memory_map();
        let me = user(1);
        let mut direct_chats = legacy_direct_chats(me, &[user(2)]);
        direct_chats.pin(user(2).into(), 10);

        // The shape the previous version serialized
        #[derive(Serialize)]
        struct DirectChatsPrevious<'a> {
            direct_chats: &'a HashMap<ChatId, DirectChat>,
            pinned: &'a Timestamped<HashMap<ChatId, TimestampMillis>>,
            metrics: ChatMetricsInternal,
            next_key_id: u32,
        }
        let bytes = msgpack::serialize_then_unwrap(DirectChatsPrevious {
            direct_chats: &direct_chats.on_heap,
            pinned: &direct_chats.pinned,
            metrics: ChatMetricsInternal::default(),
            next_key_id: 1,
        });

        let mut deserialized: DirectChats = msgpack::deserialize_then_unwrap(&bytes);
        assert_eq!(deserialized.on_heap.len(), 1);
        assert!(deserialized.in_stable_memory.is_empty());
        assert_eq!(deserialized.next_key_id, 1);
        assert_eq!(deserialized.pinned_chats().len(), 1);
        assert_eq!(deserialized.migrate_to_stable_memory(), 1);
        assert_eq!(deserialized.get(&user(2).into()).unwrap().them, user(2));

        // Once moved, the field holding the chats on the heap is no longer serialized
        #[derive(Deserialize)]
        struct Fields {
            direct_chats: Option<serde::de::IgnoredAny>,
        }
        let fields: Fields = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&deserialized));
        assert!(fields.direct_chats.is_none());
    }

    #[test]
    fn expiring_events_are_found_without_reading_the_chats() {
        init_stable_memory_map();
        let me = user(1);
        let mut direct_chats = DirectChats::default();
        for (i, ttl) in [(2, Some(100)), (3, None), (4, Some(50))] {
            let mut chat = direct_chats.get_or_create(me, user(i), UserType::User, || i as u128, 0);
            if let Some(ttl) = ttl {
                chat.set_events_time_to_live(me, Some(ttl), 0);
            }
            chat.push_message::<NullEventPusher>(message(me, i as u128, 10), None, None);
        }
        assert_eq!(direct_chats.next_event_expiry(), Some(60));
        assert!(direct_chats.chats_with_events_expiring_by(59).is_empty());
        assert_eq!(direct_chats.chats_with_events_expiring_by(60), vec![ChatId::from(user(4))]);
        let mut due = direct_chats.chats_with_events_expiring_by(110);
        due.sort();
        let mut expected = vec![ChatId::from(user(2)), ChatId::from(user(4))];
        expected.sort();
        assert_eq!(due, expected);

        direct_chats.get_mut(&user(4).into()).unwrap().remove_expired_events(60);
        assert_eq!(direct_chats.next_event_expiry(), Some(110));
        assert!(direct_chats.chats_with_events_expiring_by(109).is_empty());
    }

    #[test]
    fn users_own_chats_are_moved_onto_their_new_id() {
        init_stable_memory_map();
        let (old, new, them) = (user(1), user(2), user(3));
        let mut direct_chats = legacy_direct_chats(old, &[old]);
        direct_chats.migrate_to_stable_memory();
        direct_chats.get_or_create(old, them, UserType::User, || 2, 10);
        direct_chats.pin(old.into(), 20);

        direct_chats.migrate_own_user_id(old, new);

        assert!(direct_chats.get(&old.into()).is_none());
        assert_eq!(direct_chats.get(&new.into()).unwrap().them, new);
        assert_eq!(direct_chats.get(&them.into()).unwrap().them, them);
        assert_eq!(direct_chats.pinned_chats(), HashMap::from([(Chat::Direct(new.into()), 20)]));
    }

    #[test]
    fn each_users_chats_are_scoped_to_them_in_a_multi_user_canister() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_multi_user(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
        let them = user(9);

        // Both users' first chats have key_id 1
        let mut first = with_key_scope(KeyScope::User(1), || {
            let mut direct_chats = DirectChats::default();
            direct_chats.get_or_create(user(1), them, UserType::User, || 1, 10).archived = Timestamped::new(true, 20);
            direct_chats
        });
        let second = with_key_scope(KeyScope::User(2), || {
            let mut direct_chats = DirectChats::default();
            direct_chats.get_or_create(user(2), them, UserType::User, || 2, 10);
            direct_chats
        });

        with_key_scope(KeyScope::User(1), || {
            assert!(first.get(&them.into()).unwrap().archived.value);
            first.remove(them.into(), 30);
        });
        with_key_scope(KeyScope::User(2), || {
            assert!(!second.get(&them.into()).unwrap().archived.value)
        });
    }

    fn legacy_direct_chats(me: UserId, others: &[UserId]) -> DirectChats {
        let mut direct_chats = DirectChats::default();
        for &them in others {
            direct_chats.next_key_id += 1;
            let chat = DirectChat::new(me, them, UserType::User, direct_chats.next_key_id, None, 1, 10);
            direct_chats.on_heap.insert(them.into(), chat);
        }
        direct_chats
    }

    fn sorted_summaries(direct_chats: &DirectChats) -> Vec<(UserId, TimestampMillis)> {
        let mut summaries: Vec<_> = direct_chats.iter().map(|c| (c.them, c.last_updated())).collect();
        summaries.sort();
        summaries
    }

    fn updated_since(direct_chats: &DirectChats, since: TimestampMillis) -> Vec<UserId> {
        direct_chats.updated_since(since).map(|c| c.them).collect()
    }

    fn entry(direct_chats: &DirectChats, them: UserId) -> DirectChatEntry {
        *direct_chats.in_stable_memory.get(&them.into()).unwrap()
    }

    fn stable_memory_bytes(direct_chats: &DirectChats, them: UserId) -> Vec<u8> {
        let key_id = entry(direct_chats, them).key_id;
        with_map(|m| m.get(DirectChatKeyPrefix::new().create_key(&key_id))).unwrap()
    }

    fn chat_count_in_stable_memory() -> usize {
        let prefix = DirectChatKeyPrefix::new();
        with_map(|m| m.range(prefix.create_key(&0)..=prefix.create_key(&u32::MAX)).count())
    }

    fn message(sender: UserId, message_id: u128, now: TimestampMillis) -> PushMessageArgs {
        PushMessageArgs {
            sender,
            thread_root_message_index: None,
            message_id: MessageId::from(message_id),
            content: MessageContentInternal::Text(TextContentInternal {
                text: "hello".to_string(),
            }),
            sender_context: None,
            mentioned: Vec::new(),
            replies_to: None,
            forwarded: false,
            sender_is_bot: false,
            block_level_markdown: false,
            og_previews: Vec::new(),
            now,
        }
    }

    fn user(i: u8) -> UserId {
        Principal::from_slice(&[i; 10]).into()
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
