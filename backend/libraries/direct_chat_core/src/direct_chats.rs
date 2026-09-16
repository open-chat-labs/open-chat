use crate::direct_chat::DirectChat;
use crate::{private_replies, removed_chats};
use chat_events::{ChatInternal, ChatMetricsInternal};
use oc_error_codes::OCErrorCode;
use serde::{Deserialize, Serialize};
use stable_memory_map::RemovedChatKeyPrefix;
use std::collections::{BTreeMap, BTreeSet, HashMap};
use types::{Chat, ChatId, MessageIndex, TimestampMillis, Timestamped, UserId, UserType};

#[derive(Serialize, Deserialize, Default)]
pub struct DirectChats {
    direct_chats: HashMap<ChatId, DirectChat>,
    pinned: Timestamped<HashMap<ChatId, TimestampMillis>>,
    metrics: ChatMetricsInternal,
    // The chats removed which were held on the heap, which are all moved into stable memory in
    // `post_upgrade` by `migrate_to_stable_memory`, so this is always empty otherwise.
    // TODO: Remove this after next release
    #[serde(rename = "chats_removed", default, skip_serializing)]
    removed_on_heap: BTreeSet<(TimestampMillis, ChatId)>,
    // The private replies to groups which were held on the heap, which are all moved into stable
    // memory in `post_upgrade` by `migrate_private_replies_to_stable_memory`, so this is always
    // empty otherwise.
    // TODO: Remove this after next release
    #[serde(rename = "private_replies_to_groups", default, skip_serializing)]
    private_replies_on_heap: BTreeMap<ChatId, Vec<(UserId, MessageIndex)>>,
    // Each new direct chat is assigned the next value, which is used in place of the other user's
    // id in its stable memory keys, so that if a chat is deleted then recreated with the same user
    // the new chat's keys never collide with the old chat's (which may not yet have been garbage
    // collected). Chats created before this was introduced still use the other user's id.
    #[serde(default)]
    next_key_id: u32,
}

impl DirectChats {
    pub fn get(&self, chat_id: &ChatId) -> Option<&DirectChat> {
        self.direct_chats.get(chat_id)
    }

    pub fn get_or_err(&self, chat_id: &ChatId) -> Result<&DirectChat, OCErrorCode> {
        self.get(chat_id).ok_or(OCErrorCode::ChatNotFound)
    }

    pub fn get_mut(&mut self, chat_id: &ChatId) -> Option<&mut DirectChat> {
        self.direct_chats.get_mut(chat_id)
    }

    pub fn get_mut_or_err(&mut self, chat_id: &ChatId) -> Result<&mut DirectChat, OCErrorCode> {
        self.get_mut(chat_id).ok_or(OCErrorCode::ChatNotFound)
    }

    pub fn get_or_create<F: FnOnce() -> u128>(
        &mut self,
        my_user_id: UserId,
        their_user_id: UserId,
        their_user_type: UserType,
        anonymized_id: F,
        now: TimestampMillis,
    ) -> &mut DirectChat {
        self.direct_chats.entry(their_user_id.into()).or_insert_with(|| {
            self.next_key_id += 1;
            DirectChat::new(
                my_user_id,
                their_user_id,
                their_user_type,
                self.next_key_id,
                None,
                anonymized_id(),
                now,
            )
        })
    }

    // Assigns a `key_id` to each chat created before `key_id`s were introduced, returning how many
    // were assigned. Their events are then moved to the new keys by
    // `jobs::migrate_direct_chat_events_to_key_id_keys`.
    // TODO: Remove this once every user canister has been migrated
    pub fn assign_key_ids(&mut self) -> usize {
        let mut count = 0;
        for chat in self.direct_chats.values_mut() {
            if chat.assign_key_id(self.next_key_id + 1) {
                self.next_key_id += 1;
                count += 1;
            }
        }
        count
    }

    pub fn updated_since(&self, since: TimestampMillis) -> impl Iterator<Item = &DirectChat> {
        self.direct_chats.values().filter(move |c| c.has_updates_since(since))
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
        self.direct_chats.values().any(|c| c.has_updates_since(since))
            || self.pinned.timestamp > since
            || removed_chats::any_removed_since(&RemovedChatKeyPrefix::new_for_direct_chats(), since)
    }

    pub fn iter(&self) -> impl Iterator<Item = &DirectChat> {
        self.direct_chats.values()
    }

    pub fn iter_mut(&mut self) -> impl Iterator<Item = &mut DirectChat> {
        self.direct_chats.values_mut()
    }

    pub fn len(&self) -> usize {
        self.direct_chats.len()
    }

    pub fn is_empty(&self) -> bool {
        self.direct_chats.is_empty()
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
                if let Some(chat) = self.direct_chats.get_mut(&user_id.into()) {
                    chat.migrate_reply(message_index, old, new, now);
                }
            }
        }
    }

    pub fn aggregate_metrics(&mut self) {
        let mut metrics = ChatMetricsInternal::default();

        for chat in self.direct_chats.values() {
            metrics.merge(chat.events().metrics());
        }

        self.metrics = metrics;
    }

    pub fn metrics(&self) -> &ChatMetricsInternal {
        &self.metrics
    }

    pub fn exists(&self, chat_id: &ChatId) -> bool {
        self.direct_chats.contains_key(chat_id)
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

    // TODO: Remove this after next release
    pub fn migrate_removed_to_stable_memory(&mut self) -> usize {
        removed_chats::migrate_to_stable_memory(
            &RemovedChatKeyPrefix::new_for_direct_chats(),
            std::mem::take(&mut self.removed_on_heap)
                .into_iter()
                .map(|(timestamp, chat_id)| (timestamp, chat_id.into())),
        )
    }

    // TODO: Remove this after next release
    pub fn migrate_private_replies_to_stable_memory(&mut self) -> usize {
        private_replies::migrate_to_stable_memory(std::mem::take(&mut self.private_replies_on_heap))
    }

    pub fn remove(&mut self, chat_id: ChatId, now: TimestampMillis) -> Option<DirectChat> {
        if let Some(chat) = self.direct_chats.remove(&chat_id) {
            removed_chats::add(&RemovedChatKeyPrefix::new_for_direct_chats(), chat_id.into(), now);
            Some(chat)
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};

    #[test]
    fn removed_direct_chats_serialized_before_the_migration_are_migrated_to_stable_memory() {
        init_stable_memory_map();
        let mut direct_chats = deserialize_legacy((1..=5).map(|i| (i as u64 * 10, chat(i))).collect(), BTreeMap::new());

        assert!(!direct_chats.any_updated(0));
        assert_eq!(direct_chats.migrate_removed_to_stable_memory(), 5);
        assert_eq!(direct_chats.migrate_removed_to_stable_memory(), 0);
        assert_eq!(direct_chats.removed_since(20), vec![chat(5), chat(4), chat(3)]);
        assert!(direct_chats.any_updated(49));
        assert!(!direct_chats.any_updated(50));
    }

    #[test]
    fn private_replies_serialized_before_the_migration_are_migrated_to_stable_memory() {
        init_stable_memory_map();
        let mut direct_chats = deserialize_legacy(
            BTreeSet::new(),
            BTreeMap::from([
                (chat(1), (1..=3u8).map(|i| (user(i), (i as u32).into())).collect()),
                (chat(2), vec![(user(1), 1.into())]),
            ]),
        );

        assert_eq!(direct_chats.migrate_private_replies_to_stable_memory(), 4);
        assert_eq!(direct_chats.migrate_private_replies_to_stable_memory(), 0);
        assert_eq!(
            private_replies::take(chat(1)),
            (1..=3u8).map(|i| (user(i), (i as u32).into())).collect::<Vec<_>>()
        );
        assert_eq!(private_replies::take(chat(2)), vec![(user(1), 1.into())]);
    }

    // The format `DirectChats` was serialized in before the removed chats and the private replies
    // were moved into stable memory
    fn deserialize_legacy(
        chats_removed: BTreeSet<(TimestampMillis, ChatId)>,
        private_replies_to_groups: BTreeMap<ChatId, Vec<(UserId, MessageIndex)>>,
    ) -> DirectChats {
        #[derive(Serialize)]
        struct LegacyDirectChats {
            direct_chats: HashMap<ChatId, DirectChat>,
            pinned: Timestamped<HashMap<ChatId, TimestampMillis>>,
            metrics: ChatMetricsInternal,
            chats_removed: BTreeSet<(TimestampMillis, ChatId)>,
            private_replies_to_groups: BTreeMap<ChatId, Vec<(UserId, MessageIndex)>>,
        }

        let legacy = LegacyDirectChats {
            direct_chats: HashMap::new(),
            pinned: Timestamped::default(),
            metrics: ChatMetricsInternal::default(),
            chats_removed,
            private_replies_to_groups,
        };

        msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&legacy))
    }

    fn chat(i: u8) -> ChatId {
        Principal::from_slice(&[i; 10]).into()
    }

    fn user(i: u8) -> UserId {
        Principal::from_slice(&[i; 10]).into()
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
