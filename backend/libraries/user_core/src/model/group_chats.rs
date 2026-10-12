use crate::model::group_chat::GroupChat;
use constants::MAX_PINNED_CHATS;
use direct_chat::removed_chats;
use oc_error_codes::OCErrorCode;
use serde::{Deserialize, Serialize};
use stable_memory_map::{
    GroupChatKey, GroupChatKeyPrefix, HeapStableSplitMap, HeapStableSplitMapMut, HeapStableSplitMapRef,
    HeapStableSplitMapValue, KeyPrefix, RemovedChatKeyPrefix,
};
use std::collections::HashMap;
use types::{CanisterId, Chat, ChatId, MessageIndex, OCResult, TimestampMillis, Timestamped};

// The groups the user is in, each of which is stored whole in the stable memory map (see
// `HeapStableSplitMap`). The heap only holds when each was last updated.
#[derive(Serialize, Deserialize, Default)]
pub struct GroupChats {
    groups_created: u32,
    group_chats_v2: HeapStableSplitMap<GroupChat>,
    pinned: Timestamped<HashMap<ChatId, TimestampMillis>>,
}

// What is kept on the heap for each group
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct GroupChatEntry {
    #[serde(rename = "u")]
    last_updated: TimestampMillis,
}

impl HeapStableSplitMapValue for GroupChat {
    type Id = ChatId;
    type Entry = GroupChatEntry;
    type Key = GroupChatKey;

    fn entry(&self) -> GroupChatEntry {
        GroupChatEntry {
            last_updated: self.last_updated(),
        }
    }

    fn key(chat_id: &ChatId, _: &GroupChatEntry) -> GroupChatKey {
        GroupChatKeyPrefix::new().create_key(chat_id)
    }

    fn to_bytes(&self) -> Vec<u8> {
        msgpack::serialize_then_unwrap(self)
    }

    fn from_bytes(bytes: &[u8]) -> Self {
        msgpack::deserialize_then_unwrap(bytes)
    }
}

impl GroupChats {
    pub fn exists(&self, chat_id: &ChatId) -> bool {
        self.group_chats_v2.contains_key(chat_id)
    }

    pub fn updated_since(&self, since: TimestampMillis) -> impl Iterator<Item = HeapStableSplitMapRef<GroupChat>> {
        self.group_chats_v2.filter(move |entry| entry.last_updated > since)
    }

    pub fn pinned_chats(&self) -> HashMap<Chat, TimestampMillis> {
        self.pinned.value.iter().map(|(k, v)| (Chat::Group(*k), *v)).collect()
    }

    pub fn pinned_chats_if_updated(&self, since: TimestampMillis) -> Option<HashMap<Chat, TimestampMillis>> {
        self.pinned
            .if_set_after(since)
            .map(|ids| ids.iter().map(|(k, v)| (Chat::Group(*k), *v)).collect())
    }

    pub fn removed_since(&self, timestamp: TimestampMillis) -> Vec<ChatId> {
        removed_chats::removed_since_excluding(&RemovedChatKeyPrefix::new_for_group_chats(), timestamp, |chat_id| {
            self.exists(chat_id)
        })
    }

    pub fn get_mut(&mut self, chat_id: &ChatId) -> Option<HeapStableSplitMapMut<'_, GroupChat>> {
        self.group_chats_v2.get_mut(chat_id)
    }

    pub fn any_updated(&self, since: TimestampMillis) -> bool {
        self.group_chats_v2.entries().any(|(_, entry)| entry.last_updated > since)
            || self.pinned.timestamp > since
            || removed_chats::any_removed_since(&RemovedChatKeyPrefix::new_for_group_chats(), since)
    }

    pub fn create(&mut self, chat_id: ChatId, local_user_index_canister_id: CanisterId, now: TimestampMillis) -> bool {
        self.join(chat_id, local_user_index_canister_id, None, now);
        self.groups_created += 1;
        true
    }

    pub fn join(
        &mut self,
        chat_id: ChatId,
        local_user_index_canister_id: CanisterId,
        read_up_to: Option<MessageIndex>,
        now: TimestampMillis,
    ) -> bool {
        if self.exists(&chat_id) {
            false
        } else {
            self.group_chats_v2.insert(
                chat_id,
                GroupChat::new(chat_id, local_user_index_canister_id, read_up_to, now),
            );
            true
        }
    }

    pub fn remove(&mut self, chat_id: ChatId, now: TimestampMillis) -> Option<GroupChat> {
        removed_chats::add(&RemovedChatKeyPrefix::new_for_group_chats(), chat_id.into(), now);
        self.unpin(&chat_id, now);
        self.group_chats_v2.remove(&chat_id)
    }

    // Every group, each of which is read from stable memory as the iterator reaches it
    pub fn iter(&self) -> impl Iterator<Item = HeapStableSplitMapRef<GroupChat>> {
        self.group_chats_v2.iter()
    }

    pub fn ids(&self) -> impl Iterator<Item = ChatId> + '_ {
        self.group_chats_v2.ids()
    }

    pub fn groups_created(&self) -> u32 {
        self.groups_created
    }

    pub fn len(&self) -> usize {
        self.group_chats_v2.len()
    }

    pub fn is_empty(&self) -> bool {
        self.group_chats_v2.is_empty()
    }

    // Pins the group, provided fewer than `MAX_PINNED_CHATS` groups are pinned. The user's canister
    // needn't have heard of the group yet, since it hears of a join after the website does.
    pub fn pin(&mut self, chat_id: ChatId, now: TimestampMillis) -> OCResult {
        if !self.pinned.value.contains_key(&chat_id) {
            if self.pinned.value.len() >= MAX_PINNED_CHATS {
                return Err(OCErrorCode::LimitReached.with_message(MAX_PINNED_CHATS));
            }
            self.pinned.timestamp = now;
            self.pinned.value.insert(chat_id, now);
        }
        Ok(())
    }

    pub fn unpin(&mut self, chat_id: &ChatId, now: TimestampMillis) {
        if self.pinned.value.contains_key(chat_id) {
            self.pinned.timestamp = now;
            self.pinned.value.remove(chat_id);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use stable_memory_map::{with_map, with_map_mut};

    #[test]
    fn removed_since_excludes_groups_rejoined() {
        init_stable_memory_map();
        let mut group_chats = GroupChats::default();
        let local_user_index = Principal::from_slice(&[9; 10]);

        for i in 1..=3 {
            group_chats.join(chat(i), local_user_index, None, i as u64);
        }
        group_chats.remove(chat(1), 10);
        group_chats.remove(chat(2), 20);
        group_chats.remove(chat(3), 30);
        group_chats.join(chat(2), local_user_index, None, 40);
        group_chats.remove(chat(1), 50);

        assert_eq!(group_chats.removed_since(0), vec![chat(1), chat(3)]);
        assert_eq!(group_chats.removed_since(30), vec![chat(1)]);
        assert!(group_chats.removed_since(50).is_empty());
        assert!(group_chats.any_updated(49));
    }

    #[test]
    fn groups_are_pinned_up_to_the_limit_and_leaving_unpins() {
        init_stable_memory_map();
        let mut group_chats = GroupChats::default();
        let local_user_index = Principal::from_slice(&[9; 10]);

        for i in 0..=MAX_PINNED_CHATS as u8 {
            group_chats.join(chat(i + 10), local_user_index, None, 10);
        }
        for i in 0..MAX_PINNED_CHATS as u8 {
            group_chats.pin(chat(i + 10), 20).unwrap();
        }
        let extra = chat(MAX_PINNED_CHATS as u8 + 10);
        let error = group_chats.pin(extra, 30).unwrap_err();
        assert!(error.matches_code(OCErrorCode::LimitReached), "{error:?}");

        group_chats.remove(chat(10), 40);
        assert_eq!(group_chats.pinned_chats().len(), MAX_PINNED_CHATS - 1);
        assert!(group_chats.pinned_chats_if_updated(39).is_some());
        group_chats.pin(extra, 50).unwrap();
    }

    #[test]
    fn groups_are_stored_in_stable_memory_and_written_back_when_changed() {
        init_stable_memory_map();
        let mut group_chats = GroupChats::default();
        let local_user_index = Principal::from_slice(&[9; 10]);
        for i in 1..=3 {
            group_chats.join(chat(i), local_user_index, None, i as u64);
        }
        assert!((1..=3).all(|i| is_stored(chat(i))));
        assert!(!group_chats.join(chat(1), local_user_index, None, 5));

        group_chats
            .get_mut(&chat(2))
            .unwrap()
            .mark_read(Some(7.into()), Vec::new(), None, 50);
        let updated: Vec<_> = group_chats
            .updated_since(10)
            .map(|g| (g.chat_id, g.messages_read.read_by_me_up_to.value))
            .collect();
        assert_eq!(updated, vec![(chat(2), Some(7.into()))]);
        assert!(group_chats.any_updated(49));
        assert!(!group_chats.any_updated(50));

        // Leaving a group removes it from stable memory
        let removed = group_chats.remove(chat(3), 60).unwrap();
        assert_eq!(removed.chat_id, chat(3));
        assert!(!is_stored(chat(3)));
        assert!(!group_chats.exists(&chat(3)));
        assert_eq!(group_chats.removed_since(55), vec![chat(3)]);

        // Which groups the user is in, and whether any were updated, is known without reading them
        for i in 1..=2 {
            with_map_mut(|m| m.insert(GroupChatKeyPrefix::new().create_key(&chat(i)), vec![1, 2, 3]));
        }
        let mut ids: Vec<_> = group_chats.ids().collect();
        ids.sort();
        assert_eq!(ids, vec![chat(1), chat(2)]);
        assert!(group_chats.exists(&chat(2)));
        assert!(group_chats.updated_since(50).next().is_none());
        assert_eq!(group_chats.len(), 2);
    }

    fn is_stored(chat_id: ChatId) -> bool {
        with_map(|m| m.contains_key(GroupChatKeyPrefix::new().create_key(&chat_id)))
    }

    fn chat(i: u8) -> ChatId {
        Principal::from_slice(&[i; 10]).into()
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
