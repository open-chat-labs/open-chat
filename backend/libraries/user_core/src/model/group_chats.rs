use crate::model::group_chat::GroupChat;
use constants::MAX_PINNED_CHATS;
use direct_chat::removed_chats;
use oc_error_codes::OCErrorCode;
use serde::{Deserialize, Serialize};
use stable_memory_map::RemovedChatKeyPrefix;
use std::collections::HashMap;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use types::{CanisterId, Chat, ChatId, MessageIndex, OCResult, TimestampMillis, Timestamped};

#[derive(Serialize, Deserialize, Default)]
pub struct GroupChats {
    groups_created: u32,
    group_chats: HashMap<ChatId, GroupChat>,
    pinned: Timestamped<HashMap<ChatId, TimestampMillis>>,
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
        self.unpin(&chat_id, now);
        self.group_chats.remove(&chat_id)
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

    pub fn is_empty(&self) -> bool {
        self.group_chats.is_empty()
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

    fn chat(i: u8) -> ChatId {
        Principal::from_slice(&[i; 10]).into()
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
