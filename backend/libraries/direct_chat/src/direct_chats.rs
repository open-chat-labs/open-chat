use crate::direct_chat::DirectChat;
use crate::{private_replies, removed_chats};
use chat_events::{ChatInternal, ChatMetricsInternal};
use oc_error_codes::OCErrorCode;
use serde::{Deserialize, Serialize};
use stable_memory_map::RemovedChatKeyPrefix;
use std::collections::HashMap;
use types::{Chat, ChatId, MessageIndex, TimestampMillis, Timestamped, UserId, UserType};
use utils::migrated_user_ids::MigratedUserIds;

#[derive(Serialize, Deserialize, Default)]
pub struct DirectChats {
    direct_chats: HashMap<ChatId, DirectChat>,
    pinned: Timestamped<HashMap<ChatId, TimestampMillis>>,
    metrics: ChatMetricsInternal,
    // Each new direct chat is assigned the next value, which is used in place of the other user's
    // id in its stable memory keys, so that if a chat is deleted then recreated with the same user
    // the new chat's keys never collide with the old chat's (which may not yet have been garbage
    // collected)
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

    // Moves the user's chats onto their new id, once they are migrated to a MultiUser canister. Their
    // chat with themselves is keyed by their id, so is moved to the new id, along with its pin.
    pub fn migrate_own_user_id(&mut self, old_user_id: UserId, new_user_id: UserId) {
        for chat in self.direct_chats.values_mut() {
            chat.migrate_own_user_id(old_user_id, new_user_id);
        }
        if let Some(chat) = self.direct_chats.remove(&old_user_id.into()) {
            self.direct_chats.insert(new_user_id.into(), chat);
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
        if self.direct_chats.contains_key(&new_user_id.into()) {
            return false;
        }
        let Some(mut chat) = self.direct_chats.remove(&old_user_id.into()) else {
            return false;
        };
        chat.migrate_their_user_id(new_user_id, now);
        self.direct_chats.insert(new_user_id.into(), chat);
        if let Some(pinned_at) = self.pinned.value.remove(&old_user_id.into()) {
            self.pinned.value.insert(new_user_id.into(), pinned_at);
            self.pinned.timestamp = now;
        }
        let old_chat_id: ChatId = old_user_id.into();
        removed_chats::add(&RemovedChatKeyPrefix::new_for_direct_chats(), old_chat_id.into(), now);
        true
    }

    // The id of the other user in the chat recorded as being with `user_id`: `user_id` itself, or, if
    // the chat has since been moved onto their new id after they were migrated to a MultiUser
    // canister, that id. For what was recorded against the chat before it moved, such as timer jobs
    // and the locations of P2P swaps.
    pub fn latest_user_id(&self, user_id: UserId, migrated_user_ids: &MigratedUserIds) -> UserId {
        if self.direct_chats.contains_key(&user_id.into()) {
            user_id
        } else {
            migrated_user_ids.latest(user_id)
        }
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

    fn user(i: u8) -> UserId {
        Principal::from_slice(&[i; 10]).into()
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
