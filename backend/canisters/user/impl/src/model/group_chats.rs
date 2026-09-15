use crate::model::group_chat::GroupChat;
use crate::model::removed_chats;
use serde::{Deserialize, Serialize};
use stable_memory_map::RemovedChatKeyPrefix;
use std::collections::HashMap;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use types::{CanisterId, Chat, ChatId, MessageIndex, TimestampMillis, Timestamped};

#[derive(Serialize, Deserialize, Default)]
pub struct GroupChats {
    groups_created: u32,
    group_chats: HashMap<ChatId, GroupChat>,
    pinned: Timestamped<HashMap<ChatId, TimestampMillis>>,
    // The groups removed which were held on the heap, which are all moved into stable memory in
    // `post_upgrade` by `migrate_to_stable_memory`, so this is always empty otherwise.
    // TODO: Remove this after next release
    #[serde(rename = "removed", default, skip_serializing)]
    removed_on_heap: Vec<RemovedGroup>,
}

#[derive(Serialize, Deserialize)]
struct RemovedGroup {
    chat_id: ChatId,
    timestamp: TimestampMillis,
}

impl GroupChats {
    pub fn exists(&self, chat_id: &ChatId) -> bool {
        self.group_chats.contains_key(chat_id)
    }

    pub fn updated_since(&self, since: TimestampMillis) -> impl Iterator<Item = &GroupChat> {
        self.group_chats.values().filter(move |c| c.last_updated() > since)
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
            self.group_chats.contains_key(chat_id)
        })
    }

    pub fn get_mut(&mut self, chat_id: &ChatId) -> Option<&mut GroupChat> {
        self.group_chats.get_mut(chat_id)
    }

    pub fn any_updated(&self, since: TimestampMillis) -> bool {
        self.group_chats.values().any(|c| c.last_updated() > since)
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
        match self.group_chats.entry(chat_id) {
            Vacant(e) => {
                e.insert(GroupChat::new(chat_id, local_user_index_canister_id, read_up_to, now));
                true
            }
            Occupied(_) => false,
        }
    }

    pub fn remove(&mut self, chat_id: ChatId, now: TimestampMillis) -> Option<GroupChat> {
        removed_chats::add(&RemovedChatKeyPrefix::new_for_group_chats(), chat_id.into(), now);
        self.group_chats.remove(&chat_id)
    }

    // TODO: Remove this after next release
    pub fn migrate_removed_to_stable_memory(&mut self) -> usize {
        removed_chats::migrate_to_stable_memory(
            &RemovedChatKeyPrefix::new_for_group_chats(),
            std::mem::take(&mut self.removed_on_heap)
                .into_iter()
                .map(|g| (g.timestamp, g.chat_id.into())),
        )
    }

    pub fn iter(&self) -> impl Iterator<Item = &GroupChat> {
        self.group_chats.values()
    }

    pub fn iter_mut(&mut self) -> impl Iterator<Item = &mut GroupChat> {
        self.group_chats.values_mut()
    }

    pub fn groups_created(&self) -> u32 {
        self.groups_created
    }

    pub fn len(&self) -> usize {
        self.group_chats.len()
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
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};

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
    fn removed_groups_serialized_before_the_migration_are_migrated_to_stable_memory() {
        // The format `GroupChats` was serialized in before the removed groups were moved into
        // stable memory
        #[derive(Serialize)]
        struct LegacyGroupChats {
            groups_created: u32,
            group_chats: HashMap<ChatId, GroupChat>,
            pinned: Timestamped<HashMap<ChatId, TimestampMillis>>,
            removed: Vec<RemovedGroup>,
        }

        init_stable_memory_map();
        let legacy = LegacyGroupChats {
            groups_created: 2,
            group_chats: HashMap::new(),
            pinned: Timestamped::default(),
            removed: (1..=5)
                .map(|i| RemovedGroup {
                    chat_id: chat(i),
                    timestamp: i as u64 * 10,
                })
                .collect(),
        };

        let mut group_chats: GroupChats = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&legacy));

        assert_eq!(group_chats.groups_created(), 2);
        assert_eq!(group_chats.migrate_removed_to_stable_memory(), 5);
        assert_eq!(group_chats.migrate_removed_to_stable_memory(), 0);
        assert_eq!(group_chats.removed_since(20), vec![chat(5), chat(4), chat(3)]);
    }

    fn chat(i: u8) -> ChatId {
        Principal::from_slice(&[i; 10]).into()
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
