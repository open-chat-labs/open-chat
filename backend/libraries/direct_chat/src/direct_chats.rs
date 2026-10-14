use crate::direct_chat::DirectChat;
use crate::{private_replies, removed_chats};
use chat_events::{ChatInternal, ChatMetricsInternal};
use constants::MAX_PINNED_CHATS;
use oc_error_codes::OCErrorCode;
use serde::{Deserialize, Serialize};
use stable_memory_map::{
    DirectChatKey, DirectChatKeyPrefix, HeapStableSplitMap, HeapStableSplitMapMut, HeapStableSplitMapRef,
    HeapStableSplitMapValue, KeyPrefix, RemovedChatKeyPrefix,
};
use std::collections::{HashMap, HashSet};
use std::ops::ControlFlow;
use types::{Chat, ChatId, MessageIndex, OCResult, TimestampMillis, Timestamped, UserId, UserType};
use utils::migrated_user_ids::MigratedUserIds;

pub type DirectChatRef<'a> = HeapStableSplitMapRef<'a, DirectChat>;
pub type DirectChatMut<'a> = HeapStableSplitMapMut<'a, DirectChat>;

// The user's direct chats, each of which is stored whole in the stable memory map, keyed by its
// `key_id` (see `HeapStableSplitMap`). The heap only holds a small entry per chat, from which the chats
// which have been updated or have events due to expire can be found without reading them.
#[derive(Serialize, Deserialize, Default)]
pub struct DirectChats {
    direct_chats_v2: HeapStableSplitMap<DirectChat>,
    pinned: Timestamped<HashMap<ChatId, TimestampMillis>>,
    // Each new direct chat is assigned the next value, which is used in place of the other user's
    // id in its stable memory keys, so that if a chat is deleted then recreated with the same user
    // the new chat's keys never collide with the old chat's (which may not yet have been garbage
    // collected)
    next_key_id: u32,
}

// What is kept on the heap for each chat
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct DirectChatEntry {
    #[serde(rename = "k")]
    key_id: u32,
    #[serde(rename = "t")]
    user_type: UserType,
    #[serde(rename = "u")]
    last_updated: TimestampMillis,
    #[serde(rename = "e", default, skip_serializing_if = "Option::is_none")]
    next_event_expiry: Option<TimestampMillis>,
}

impl HeapStableSplitMapValue for DirectChat {
    type Id = ChatId;
    type Entry = DirectChatEntry;
    type Key = DirectChatKey;

    fn entry(&self) -> DirectChatEntry {
        DirectChatEntry {
            key_id: self.key_id(),
            user_type: self.user_type,
            last_updated: self.last_updated(),
            next_event_expiry: self.events().next_event_expiry(),
        }
    }

    fn key(_: &ChatId, entry: &DirectChatEntry) -> DirectChatKey {
        DirectChatKeyPrefix::new().create_key(&entry.key_id)
    }

    fn to_bytes(&self) -> Vec<u8> {
        msgpack::serialize_then_unwrap(self)
    }

    fn from_bytes(bytes: &[u8]) -> Self {
        msgpack::deserialize_then_unwrap(bytes)
    }
}

impl DirectChats {
    pub fn get(&self, chat_id: &ChatId) -> Option<DirectChatRef<'_>> {
        self.direct_chats_v2.get(chat_id)
    }

    pub fn get_or_err(&self, chat_id: &ChatId) -> Result<DirectChatRef<'_>, OCErrorCode> {
        self.get(chat_id).ok_or(OCErrorCode::ChatNotFound)
    }

    pub fn get_mut(&mut self, chat_id: &ChatId) -> Option<DirectChatMut<'_>> {
        self.direct_chats_v2.get_mut(chat_id)
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
        self.direct_chats_v2.insert(chat_id, chat)
    }

    pub fn updated_since(&self, since: TimestampMillis) -> impl Iterator<Item = DirectChatRef<'_>> {
        self.direct_chats_v2.filter(move |entry| entry.last_updated > since)
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
        self.direct_chats_v2.entries().any(|(_, entry)| entry.last_updated > since)
            || self.pinned.timestamp > since
            || removed_chats::any_removed_since(&RemovedChatKeyPrefix::new_for_direct_chats(), since)
    }

    // Every chat, each of which is read from stable memory as the iterator reaches it
    pub fn iter(&self) -> impl Iterator<Item = DirectChatRef<'_>> {
        self.direct_chats_v2.iter()
    }

    // The id of each chat, ordered by its key_id, which, unlike its id, stays the same for as long as
    // the chat exists (see `migrate_their_user_id`)
    pub fn ids_ordered_by_key_id(&self) -> Vec<(u32, ChatId)> {
        let mut ids: Vec<_> = self
            .direct_chats_v2
            .entries()
            .map(|(chat_id, entry)| (entry.key_id, chat_id))
            .collect();
        ids.sort_unstable();
        ids
    }

    // Applies `f` to each of the chats given in turn until it returns `Break`, then writes back
    // every chat it was applied to together (see `HeapStableSplitMap::update_many`)
    pub fn update_many<B>(
        &mut self,
        chat_ids: impl IntoIterator<Item = ChatId>,
        f: impl FnMut(&ChatId, &mut DirectChat) -> ControlFlow<B>,
    ) -> Option<B> {
        self.direct_chats_v2.update_many(chat_ids, f)
    }

    // The id of every chat, without reading the chats from stable memory
    pub fn ids(&self) -> impl Iterator<Item = ChatId> + '_ {
        self.direct_chats_v2.ids()
    }

    pub fn len(&self) -> usize {
        self.direct_chats_v2.len()
    }

    pub fn is_empty(&self) -> bool {
        self.direct_chats_v2.is_empty()
    }

    pub fn mark_private_reply(&mut self, user_id: UserId, chat: ChatInternal, message_index: MessageIndex) {
        if let ChatInternal::Group(chat_id) = chat {
            private_replies::add(chat_id, user_id, message_index);
        }
    }

    // Points the private replies to messages in the `old` chat at the `new` chat. Each reply is
    // recorded under the id the other user in its chat had when it was sent, which the chat may
    // since have moved off (see `migrate_their_user_id`).
    pub fn migrate_replies(
        &mut self,
        old: ChatInternal,
        new: ChatInternal,
        migrated_user_ids: &MigratedUserIds,
        now: TimestampMillis,
    ) {
        if let ChatInternal::Group(chat_id) = old {
            // The replies are all read and removed up front, since updating each one writes to the
            // stable memory map
            for (user_id, message_index) in private_replies::take(chat_id) {
                let user_id = self.latest_user_id(user_id, migrated_user_ids);
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
        self.direct_chats_v2
            .entries()
            .filter(|(_, entry)| entry.next_event_expiry.is_some_and(|ts| ts <= now))
            .map(|(chat_id, _)| chat_id)
            .collect()
    }

    // When the next event due to expire in any of the chats expires
    pub fn next_event_expiry(&self) -> Option<TimestampMillis> {
        self.direct_chats_v2
            .entries()
            .filter_map(|(_, entry)| entry.next_event_expiry)
            .min()
    }

    pub fn exists(&self, chat_id: &ChatId) -> bool {
        self.direct_chats_v2.contains_key(chat_id)
    }

    // The type of the other user in the chat, if there is one, without reading the chat
    pub fn user_type(&self, chat_id: &ChatId) -> Option<UserType> {
        self.direct_chats_v2.entry(chat_id).map(|entry| entry.user_type)
    }

    // Pins the chat, provided fewer than `MAX_PINNED_CHATS` chats are pinned. The chat needn't exist
    // yet, since the website lets the user pin a chat before its first message has been sent.
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

    // Moves the chat with another user onto their new id, once they are migrated to a MultiUser
    // canister, along with its pin, so that events from them under their new id are added to it. The
    // chat under their old id is recorded as removed, so that clients drop it and pick it up under
    // the new id. If there is already a chat under the new id, eg. because a message from them under
    // it arrived first, both chats are left as they are. A pin under the old id with no chat, since
    // a chat can be pinned before it has any messages, is moved too. Returns whether the chat was
    // moved.
    pub fn migrate_their_user_id(&mut self, old_user_id: UserId, new_user_id: UserId, now: TimestampMillis) -> bool {
        let old_chat_id: ChatId = old_user_id.into();
        let new_chat_id: ChatId = new_user_id.into();
        let moved = if !self.exists(&new_chat_id)
            && let Some(mut chat) = self.direct_chats_v2.remove(&old_chat_id)
        {
            chat.migrate_their_user_id(new_user_id, now);
            self.direct_chats_v2.insert(new_chat_id, chat);
            removed_chats::add(&RemovedChatKeyPrefix::new_for_direct_chats(), old_chat_id.into(), now);
            true
        } else {
            false
        };
        if !self.exists(&old_chat_id)
            && let Some(pinned_at) = self.pinned.value.remove(&old_chat_id)
        {
            // A pin already under the new id is kept
            self.pinned.value.entry(new_chat_id).or_insert(pinned_at);
            self.pinned.timestamp = now;
        }
        moved
    }

    // Writes every chat back to stable memory, so that it is stored in the current format rather than
    // as when it last changed. A chat which still holds data on the heap from before its events data
    // was stored in stable memory (see `ChatEvents::legacy_heap_entries`) is left as it is, since
    // writing it back would lose that data. Returns how many chats were rewritten and how many left.
    pub fn rewrite_all(&mut self) -> (u32, u32) {
        let mut left = 0;
        let rewritten = self.direct_chats_v2.rewrite(|_, chat| {
            let has_legacy_heap_entries = chat.events().legacy_heap_entries() > 0;
            if has_legacy_heap_entries {
                left += 1;
            }
            !has_legacy_heap_entries
        });
        (rewritten as u32, left)
    }

    // Moves what each chat holds outside its events under ids which either user had before being
    // migrated to a MultiUser canister onto the ids the chat has for them now (see
    // `DirectChat::migrate_user_ids`), returning how many chats were changed. Every chat is read,
    // but only those which change are written back.
    pub fn migrate_user_ids_in_chats(&mut self, my_user_id: UserId, migrated_user_ids: &MigratedUserIds) -> u32 {
        let chat_ids: Vec<_> = self
            .ids()
            .filter(|chat_id| {
                self.get(chat_id)
                    .is_some_and(|chat| chat.holds_user_ids_to_migrate(my_user_id, migrated_user_ids))
            })
            .collect();
        let mut updated = 0;
        self.update_many(chat_ids, |_, chat| {
            if chat.migrate_user_ids(my_user_id, migrated_user_ids) {
                updated += 1;
            }
            ControlFlow::<()>::Continue(())
        });
        updated
    }

    // The ids of the users the private replies were sent to (see `mark_private_reply`)
    pub fn private_reply_user_ids(&self) -> HashSet<UserId> {
        private_replies::user_ids()
    }

    // Moves each private reply recorded under an id the other user in its chat had before being
    // migrated onto the id of the chat it is in now (see `latest_user_id`), so that
    // `migrate_replies` finds its chat without `MigratedUserIds`. Returns how many were moved.
    pub fn migrate_private_reply_user_ids(&mut self, migrated_user_ids: &MigratedUserIds) -> u32 {
        let direct_chats = &*self;
        private_replies::update_user_ids(|user_id| direct_chats.latest_user_id(user_id, migrated_user_ids))
    }

    // The ids a pin or favourite of the chat which `user_id` names may be under until the
    // `migrate_their_user_ids` job reaches the user, so which removing one acts on: the id the chat
    // is under now (see `latest_user_id`) and, if that is the other user's latest id, each id they
    // had before which no chat is under, since the job moves a pin or favourite under one of those
    // onto the latest id. A chat left under an id they had before is a chat of its own, so is only
    // named by that id.
    pub fn ids_naming_chat(&self, user_id: UserId, migrated_user_ids: &MigratedUserIds) -> Vec<UserId> {
        let chat_user_id = self.latest_user_id(user_id, migrated_user_ids);
        let latest = migrated_user_ids.latest(user_id);
        if chat_user_id != latest {
            return vec![chat_user_id];
        }
        let mut user_ids: Vec<_> = migrated_user_ids
            .previous_ids(latest)
            .into_iter()
            .filter(|previous| !self.exists(&(*previous).into()))
            .collect();
        user_ids.push(latest);
        user_ids
    }

    // Every way the chat may be named (see `ids_naming_chat`) if it is a direct chat
    pub fn chats_naming_chat(&self, chat: Chat, migrated_user_ids: &MigratedUserIds) -> Vec<Chat> {
        match chat {
            Chat::Direct(chat_id) => self
                .ids_naming_chat(chat_id.into(), migrated_user_ids)
                .into_iter()
                .map(|user_id| Chat::Direct(user_id.into()))
                .collect(),
            _ => vec![chat],
        }
    }

    // `chat` as `latest_user_id` names it if it is a direct chat
    pub fn latest_chat(&self, chat: Chat, migrated_user_ids: &MigratedUserIds) -> Chat {
        match chat {
            Chat::Direct(chat_id) => Chat::Direct(self.latest_user_id(chat_id.into(), migrated_user_ids).into()),
            _ => chat,
        }
    }

    // The id of the other user in the chat recorded as being with `user_id`: `user_id` itself, or, if
    // the chat has since been moved onto their new id after they were migrated to a MultiUser
    // canister, that id. For what was recorded against the chat before it moved, such as timer jobs
    // and the locations of P2P swaps.
    pub fn latest_user_id(&self, user_id: UserId, migrated_user_ids: &MigratedUserIds) -> UserId {
        if self.exists(&user_id.into()) { user_id } else { migrated_user_ids.latest(user_id) }
    }

    pub fn remove(&mut self, chat_id: ChatId, now: TimestampMillis) -> Option<DirectChat> {
        let chat = self.direct_chats_v2.remove(&chat_id)?;
        removed_chats::add(&RemovedChatKeyPrefix::new_for_direct_chats(), chat_id.into(), now);
        self.unpin(&chat_id, now);
        Some(chat)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use chat_events::{
        MessageContentInternal, NullEventPusher, PushMessageArgs, Reader, ReplyContextInternal, TextContentInternal,
    };
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use stable_memory_map::{KeyScope, with_key_scope, with_map, with_map_mut};
    use std::collections::BTreeMap;
    use types::MessageId;

    #[test]
    fn chat_with_a_migrated_user_is_moved_onto_their_new_id() {
        init_stable_memory_map();
        let (me, old, new) = (user(1), user(2), user(3));
        let mut direct_chats = DirectChats::default();
        direct_chats.get_or_create(me, old, UserType::User, || 1, 10);
        direct_chats.pin(old.into(), 20).unwrap();

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
    fn pins_without_a_chat_are_moved_onto_a_migrated_users_new_id() {
        init_stable_memory_map();
        let me = user(1);
        let mut direct_chats = DirectChats::default();
        // Pinned before any messages were sent
        direct_chats.pin(user(2).into(), 10).unwrap();
        // A chat left under the old id, since there is already one under the new id
        direct_chats.get_or_create(me, user(4), UserType::User, || 1, 10);
        direct_chats.get_or_create(me, user(5), UserType::User, || 2, 10);
        direct_chats.pin(user(4).into(), 20).unwrap();
        // Pinned under both ids
        direct_chats.pin(user(6).into(), 30).unwrap();
        direct_chats.pin(user(7).into(), 40).unwrap();

        assert!(!direct_chats.migrate_their_user_id(user(2), user(3), 100));
        assert!(!direct_chats.migrate_their_user_id(user(4), user(5), 100));
        assert!(!direct_chats.migrate_their_user_id(user(6), user(7), 100));

        let pinned = |i: u8, at| (Chat::Direct(user(i).into()), at);
        assert_eq!(
            direct_chats.pinned_chats(),
            HashMap::from([pinned(3, 10), pinned(4, 20), pinned(7, 40)])
        );
        assert!(direct_chats.pinned_chats_if_updated(99).is_some());
        assert!(direct_chats.pinned_chats_if_updated(100).is_none());
    }

    #[test]
    fn chats_holding_ids_from_before_a_migration_outside_their_events_are_updated() {
        init_stable_memory_map();
        let (me, my_old, their_old, them) = (user(1), user(11), user(12), user(2));
        let mut migrated_user_ids = MigratedUserIds::default();
        migrated_user_ids.insert(my_old, me);
        migrated_user_ids.insert(their_old, them);
        let mut direct_chats = DirectChats::default();
        direct_chats
            .get_or_create(me, them, UserType::User, || 1, 10)
            .set_events_time_to_live(their_old, Some(1000), 20);
        direct_chats
            .get_or_create(me, user(3), UserType::User, || 2, 10)
            .set_events_time_to_live(my_old, Some(1000), 20);
        direct_chats
            .get_or_create(me, user(4), UserType::User, || 3, 10)
            .set_events_time_to_live(me, Some(1000), 20);

        assert_eq!(direct_chats.migrate_user_ids_in_chats(me, &migrated_user_ids), 2);

        let changed_by = |them: UserId| match direct_chats.get(&them.into()).unwrap().events_ttl_latest_change() {
            crate::EventsTtlLatestChange::Changed(change) => change.by,
            _ => panic!("The TTL was changed"),
        };
        assert_eq!(changed_by(them), them);
        assert_eq!(changed_by(user(3)), me);
        assert_eq!(changed_by(user(4)), me);
        assert_eq!(direct_chats.migrate_user_ids_in_chats(me, &migrated_user_ids), 0);
    }

    #[test]
    fn private_replies_are_moved_onto_the_id_of_the_chat_they_are_in() {
        init_stable_memory_map();
        let me = user(1);
        let group = ChatInternal::Group(Principal::from_slice(&[10; 10]).into());
        let ChatInternal::Group(group_id) = group else {
            unreachable!()
        };
        let mut migrated_user_ids = MigratedUserIds::default();
        let mut direct_chats = DirectChats::default();
        // Their chat has been moved onto their new id
        direct_chats.get_or_create(me, user(3), UserType::User, || 1, 10);
        migrated_user_ids.insert(user(2), user(3));
        direct_chats.mark_private_reply(user(2), group, 1.into());
        // Their chat was left under the old id
        direct_chats.get_or_create(me, user(4), UserType::User, || 2, 10);
        direct_chats.get_or_create(me, user(5), UserType::User, || 3, 10);
        migrated_user_ids.insert(user(4), user(5));
        direct_chats.mark_private_reply(user(4), group, 2.into());
        // They haven't been migrated
        direct_chats.mark_private_reply(user(6), group, 3.into());

        assert_eq!(
            direct_chats.private_reply_user_ids(),
            HashSet::from([user(2), user(4), user(6)])
        );
        assert_eq!(direct_chats.migrate_private_reply_user_ids(&migrated_user_ids), 1);

        assert_eq!(
            private_replies::take(group_id),
            vec![(user(3), 1.into()), (user(4), 2.into()), (user(6), 3.into())]
        );
    }

    #[test]
    fn direct_chats_are_named_by_the_id_the_chat_is_under() {
        init_stable_memory_map();
        let me = user(1);
        let mut migrated_user_ids = MigratedUserIds::default();
        migrated_user_ids.insert(user(2), user(3));
        migrated_user_ids.insert(user(4), user(5));
        let mut direct_chats = DirectChats::default();
        direct_chats.get_or_create(me, user(4), UserType::User, || 1, 10);
        let group = Chat::Group(Principal::from_slice(&[10; 10]).into());

        let latest = |i: u8| direct_chats.latest_chat(Chat::Direct(user(i).into()), &migrated_user_ids);
        assert_eq!(latest(2), Chat::Direct(user(3).into()));
        // A chat left under an old id is named by it
        assert_eq!(latest(4), Chat::Direct(user(4).into()));
        assert_eq!(latest(6), Chat::Direct(user(6).into()));
        assert_eq!(direct_chats.latest_chat(group, &migrated_user_ids), group);
    }

    #[test]
    fn a_chat_is_named_by_every_id_without_a_chat_of_its_own() {
        init_stable_memory_map();
        let me = user(1);
        // User 2 was migrated to 3 then to 4, and user 5 to 6, and the chat with user 5 was left
        // under their old id, since there is one under their new id too
        let mut migrated_user_ids = MigratedUserIds::default();
        migrated_user_ids.insert(user(2), user(3));
        migrated_user_ids.insert(user(3), user(4));
        migrated_user_ids.insert(user(5), user(6));
        let mut direct_chats = DirectChats::default();
        direct_chats.get_or_create(me, user(4), UserType::User, || 1, 10);
        direct_chats.get_or_create(me, user(5), UserType::User, || 2, 10);
        direct_chats.get_or_create(me, user(6), UserType::User, || 3, 10);

        for i in [2, 3, 4] {
            assert_eq!(
                direct_chats.ids_naming_chat(user(i), &migrated_user_ids),
                vec![user(2), user(3), user(4)]
            );
        }
        assert_eq!(direct_chats.ids_naming_chat(user(5), &migrated_user_ids), vec![user(5)]);
        assert_eq!(direct_chats.ids_naming_chat(user(6), &migrated_user_ids), vec![user(6)]);
        assert_eq!(direct_chats.ids_naming_chat(user(7), &migrated_user_ids), vec![user(7)]);

        let group = Chat::Group(Principal::from_slice(&[10; 10]).into());
        assert_eq!(direct_chats.chats_naming_chat(group, &migrated_user_ids), vec![group]);
        assert_eq!(
            direct_chats.chats_naming_chat(Chat::Direct(user(6).into()), &migrated_user_ids),
            vec![Chat::Direct(user(6).into())]
        );
    }

    #[test]
    fn private_replies_are_migrated_in_a_chat_moved_onto_a_migrated_users_new_id() {
        init_stable_memory_map();
        let (me, old, new) = (user(1), user(2), user(3));
        let group = ChatInternal::Group(Principal::from_slice(&[10; 10]).into());
        let channel = ChatInternal::Channel(Principal::from_slice(&[11; 10]).into(), 1u32.into());
        let mut direct_chats = DirectChats::default();
        let mut chat = direct_chats.get_or_create(me, old, UserType::User, || 1, 10);
        let message_index = chat
            .push_message::<NullEventPusher>(
                PushMessageArgs {
                    replies_to: Some(ReplyContextInternal {
                        chat_if_other: Some((group, None)),
                        event_index: 5.into(),
                    }),
                    ..message(me, 1, 10)
                },
                None,
                None,
            )
            .event
            .message_index;
        drop(chat);
        direct_chats.mark_private_reply(old, group, message_index);
        direct_chats.migrate_their_user_id(old, new, 20);
        let mut migrated_user_ids = MigratedUserIds::default();
        migrated_user_ids.insert(old, new);

        direct_chats.migrate_replies(group, channel, &migrated_user_ids, 30);

        let chat = direct_chats.get(&new.into()).unwrap();
        let message = chat.main_events_reader().message_internal(message_index.into()).unwrap();
        assert_eq!(message.replies_to.unwrap().chat_if_other, Some((channel, None)));
    }

    #[test]
    fn chats_are_stored_in_stable_memory_and_written_back_when_changed() {
        init_stable_memory_map();
        let (me, them) = (user(1), user(2));
        let mut direct_chats = DirectChats::default();

        direct_chats.get_or_create(me, them, UserType::User, || 1, 10);
        assert_eq!(chat_count_in_stable_memory(), 1);
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
    fn every_chat_is_rewritten_in_the_current_format() {
        init_stable_memory_map();
        let me = user(1);
        let mut direct_chats = DirectChats::default();
        direct_chats.get_or_create(me, user(2), UserType::User, || 1, 10);
        direct_chats.get_or_create(me, user(3), UserType::User, || 2, 10);
        direct_chats
            .get_mut(&user(2).into())
            .unwrap()
            .push_message::<NullEventPusher>(message(user(2), 1, 20), None, None);

        // Each chat was stored in an earlier format, with a field which is no longer read
        #[derive(Serialize)]
        struct Earlier<'a> {
            #[serde(flatten)]
            chat: &'a DirectChat,
            dropped: u32,
        }
        for them in [user(2), user(3)] {
            let chat = direct_chats.get(&them.into()).unwrap();
            let bytes = msgpack::serialize_then_unwrap(Earlier { chat: &chat, dropped: 5 });
            with_map_mut(|m| m.insert(DirectChatKeyPrefix::new().create_key(&chat.key_id()), bytes));
        }

        assert_eq!(direct_chats.rewrite_all(), (2, 0));

        for them in [user(2), user(3)] {
            let chat = direct_chats.get(&them.into()).unwrap();
            assert_eq!(stable_memory_bytes(&direct_chats, them), chat.to_bytes());
        }
        let chat = direct_chats.get(&user(2).into()).unwrap();
        assert_eq!(chat.main_events_reader().latest_message_index(), Some(0.into()));
    }

    #[test]
    fn a_chat_holding_data_on_the_heap_is_left_as_it_is() {
        use serde_value::Value;
        init_stable_memory_map();
        let me = user(1);
        let mut direct_chats = DirectChats::default();
        direct_chats.get_or_create(me, user(2), UserType::User, || 1, 10);
        direct_chats.get_or_create(me, user(3), UserType::User, || 2, 10);

        // Edits a chat's events as stored, returning the bytes written
        let edit_events = |direct_chats: &DirectChats, them: UserId, f: &dyn Fn(&mut BTreeMap<Value, Value>)| {
            let key = DirectChatKeyPrefix::new().create_key(&entry(direct_chats, them).key_id);
            let mut chat: Value = msgpack::deserialize_then_unwrap(&stable_memory_bytes(direct_chats, them));
            let Value::Map(fields) = &mut chat else { panic!() };
            let Some(Value::Map(events)) = fields.get_mut(&Value::String("events".to_string())) else {
                panic!()
            };
            f(events);
            let bytes = msgpack::serialize_then_unwrap(&chat);
            with_map_mut(|m| m.insert(key, bytes.clone()));
            bytes
        };
        // User 2's chat holds users' metrics on the heap, as chats did before they were stored in
        // stable memory, and user 3's has its message event indexes stored as a plain list, as a list
        // with nothing in stable memory used to be
        let held = edit_events(&direct_chats, user(2), &|events| {
            let metrics = BTreeMap::from([(Value::U32(1), Value::U32(2))]);
            events.insert(Value::String("per_user_metrics".to_string()), Value::Map(metrics));
        });
        edit_events(&direct_chats, user(3), &|events| {
            let Some(Value::Map(main)) = events.get_mut(&Value::String("main".to_string())) else {
                panic!()
            };
            main.insert(Value::String("message_event_indexes".to_string()), Value::Seq(Vec::new()));
        });

        assert_eq!(direct_chats.rewrite_all(), (1, 1));
        assert_eq!(stable_memory_bytes(&direct_chats, user(2)), held);
        let chat = direct_chats.get(&user(3).into()).unwrap();
        assert_eq!(stable_memory_bytes(&direct_chats, user(3)), chat.to_bytes());

        // Once rewritten, a chat is left as it is
        assert_eq!(direct_chats.rewrite_all(), (0, 1));
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
    fn expiring_events_and_user_types_are_found_without_reading_the_chats() {
        init_stable_memory_map();
        let me = user(1);
        let mut direct_chats = DirectChats::default();
        for (i, ttl, user_type) in [
            (2, Some(100), UserType::User),
            (3, None, UserType::BotV2),
            (4, Some(50), UserType::User),
        ] {
            let mut chat = direct_chats.get_or_create(me, user(i), user_type, || i as u128, 0);
            if let Some(ttl) = ttl {
                chat.set_events_time_to_live(me, Some(ttl), 0);
            }
            chat.push_message::<NullEventPusher>(message(me, i as u128, 10), None, None);
        }

        // The chats are replaced with bytes which can't be read, so that reading any of them panics
        let stored: Vec<_> = (2..=4).map(|i| (i, stable_memory_bytes(&direct_chats, user(i)))).collect();
        for (i, _) in stored.iter() {
            let key_id = entry(&direct_chats, user(*i)).key_id;
            with_map_mut(|m| m.insert(DirectChatKeyPrefix::new().create_key(&key_id), vec![1, 2, 3]));
        }
        assert_eq!(direct_chats.user_type(&user(2).into()), Some(UserType::User));
        assert_eq!(direct_chats.user_type(&user(3).into()), Some(UserType::BotV2));
        assert_eq!(direct_chats.user_type(&user(5).into()), None);
        assert_eq!(direct_chats.next_event_expiry(), Some(60));
        assert!(direct_chats.chats_with_events_expiring_by(59).is_empty());
        assert_eq!(direct_chats.chats_with_events_expiring_by(60), vec![ChatId::from(user(4))]);
        let mut due = direct_chats.chats_with_events_expiring_by(110);
        due.sort();
        let mut expected = vec![ChatId::from(user(2)), ChatId::from(user(4))];
        expected.sort();
        assert_eq!(due, expected);
        for (i, bytes) in stored {
            let key_id = entry(&direct_chats, user(i)).key_id;
            with_map_mut(|m| m.insert(DirectChatKeyPrefix::new().create_key(&key_id), bytes));
        }

        direct_chats
            .get_mut(&user(4).into())
            .unwrap()
            .remove_expired_events(&MigratedUserIds::default(), 60);
        assert_eq!(direct_chats.next_event_expiry(), Some(110));
        assert!(direct_chats.chats_with_events_expiring_by(109).is_empty());
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

    #[test]
    fn chats_are_pinned_up_to_the_limit_and_removing_a_chat_unpins_it() {
        init_stable_memory_map();
        let me = user(1);
        let mut direct_chats = DirectChats::default();

        for i in 0..MAX_PINNED_CHATS as u8 {
            direct_chats.get_or_create(me, user(i + 10), UserType::User, || 1, 10);
            direct_chats.pin(user(i + 10).into(), 20).unwrap();
        }
        let extra = user(MAX_PINNED_CHATS as u8 + 10);
        direct_chats.get_or_create(me, extra, UserType::User, || 1, 10);
        let error = direct_chats.pin(extra.into(), 30).unwrap_err();
        assert!(error.matches_code(OCErrorCode::LimitReached), "{error:?}");
        // Pinning a chat which is already pinned changes nothing
        direct_chats.pin(user(10).into(), 30).unwrap();
        assert_eq!(direct_chats.pinned_chats()[&Chat::Direct(user(10).into())], 20);

        direct_chats.remove(user(10).into(), 40);
        assert_eq!(direct_chats.pinned_chats().len(), MAX_PINNED_CHATS - 1);
        assert!(direct_chats.pinned_chats_if_updated(39).is_some());
        direct_chats.pin(extra.into(), 50).unwrap();
    }

    fn updated_since(direct_chats: &DirectChats, since: TimestampMillis) -> Vec<UserId> {
        direct_chats.updated_since(since).map(|c| c.them).collect()
    }

    fn entry(direct_chats: &DirectChats, them: UserId) -> DirectChatEntry {
        direct_chats.direct_chats_v2.entry(&them.into()).unwrap()
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
