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
#[serde(from = "GroupChatsCombined")]
pub struct GroupChats {
    groups_created: u32,
    group_chats_v2: HeapStableSplitMap<GroupChat>,
    pinned: Timestamped<HashMap<ChatId, TimestampMillis>>,
}

// Reads both the current layout and the one before it, in which every group was on the heap. Groups
// read from the previous layout are moved into stable memory by `migrate_to_stable_memory`, which
// only leaves them there in a User canister whose user was being migrated when it was upgraded, or in
// a user imported from such a canister until their import completes. This can be removed once every
// User canister has been upgraded with no migration in progress.
#[derive(Deserialize)]
struct GroupChatsCombined {
    groups_created: u32,
    #[serde(default)]
    group_chats: HashMap<ChatId, GroupChat>,
    #[serde(default)]
    group_chats_v2: HeapStableSplitMap<GroupChat>,
    pinned: Timestamped<HashMap<ChatId, TimestampMillis>>,
}

impl From<GroupChatsCombined> for GroupChats {
    fn from(value: GroupChatsCombined) -> Self {
        let mut group_chats_v2 = value.group_chats_v2;
        group_chats_v2.extend_from_heap(value.group_chats);
        GroupChats {
            groups_created: value.groups_created,
            group_chats_v2,
            pinned: value.pinned,
        }
    }
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

    pub fn updated_since(&self, since: TimestampMillis) -> impl Iterator<Item = HeapStableSplitMapRef<'_, GroupChat>> {
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
    pub fn iter(&self) -> impl Iterator<Item = HeapStableSplitMapRef<'_, GroupChat>> {
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

    // Moves every group still on the heap into stable memory, returning how many were moved
    pub fn migrate_to_stable_memory(&mut self) -> usize {
        self.group_chats_v2.migrate_to_stable_memory()
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

    #[test]
    fn groups_from_the_previous_layout_are_moved_into_stable_memory() {
        init_stable_memory_map();
        let local_user_index = Principal::from_slice(&[9; 10]);

        #[derive(Serialize)]
        struct GroupChatsPrevious {
            groups_created: u32,
            group_chats: HashMap<ChatId, GroupChat>,
            pinned: Timestamped<HashMap<ChatId, TimestampMillis>>,
        }
        let mut group = GroupChat::new(chat(1), local_user_index, Some(3.into()), 10);
        group.archived = Timestamped::new(true, 20);
        let previous = GroupChatsPrevious {
            groups_created: 4,
            group_chats: HashMap::from([
                (chat(1), group),
                (chat(2), GroupChat::new(chat(2), local_user_index, None, 30)),
            ]),
            pinned: Timestamped::new(HashMap::from([(chat(2), 30)]), 30),
        };
        let group_chats: GroupChats = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(previous));

        // The groups are read from the heap until they are moved
        assert_eq!(group_chats.len(), 2);
        assert_eq!(group_chats.groups_created(), 4);
        assert_eq!(group_chats.pinned_chats().len(), 1);
        assert_eq!(group_chats.updated_since(25).count(), 1);
        assert!(!is_stored(chat(1)));

        // They survive being serialized while still on the heap, as when a User canister whose user
        // is being migrated is upgraded again
        let mut group_chats: GroupChats = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&group_chats));
        assert_eq!(group_chats.len(), 2);
        assert_eq!(group_chats.groups_created(), 4);
        assert_eq!(group_chats.updated_since(25).count(), 1);
        assert!(!is_stored(chat(1)));

        assert_eq!(group_chats.migrate_to_stable_memory(), 2);
        assert_eq!(group_chats.migrate_to_stable_memory(), 0);
        assert!(is_stored(chat(1)) && is_stored(chat(2)));
        let group = group_chats.iter().find(|g| g.chat_id == chat(1)).unwrap();
        assert_eq!(group.messages_read.read_by_me_up_to.value, Some(3.into()));
        assert!(group.archived.value);
        assert_eq!(group_chats.updated_since(25).count(), 1);

        // Once moved, they are serialized under the current layout only
        #[derive(Deserialize)]
        struct Fields {
            group_chats: Option<serde::de::IgnoredAny>,
        }
        let fields: Fields = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&group_chats));
        assert!(fields.group_chats.is_none());
        let deserialized: GroupChats = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&group_chats));
        assert_eq!(deserialized.len(), 2);
        assert!(deserialized.updated_since(25).next().is_some());
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
