use crate::model::group_chat::GroupChat;
use serde::{Deserialize, Deserializer, Serialize};
use std::collections::HashMap;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use types::{CanisterId, ChatId, MessageIndex, TimestampMillis, Timestamped};

#[derive(Serialize, Default)]
pub struct GroupChats {
    groups_created: u32,
    group_chats: HashMap<ChatId, GroupChat>,
    pinned: Timestamped<HashMap<ChatId, TimestampMillis>>,
    removed: Vec<RemovedGroup>,
}

// TODO: Remove this after the next release
impl<'de> Deserialize<'de> for GroupChats {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct OldGroupChats {
            groups_created: u32,
            group_chats: HashMap<ChatId, GroupChat>,
            pinned: Timestamped<Vec<ChatId>>,
            removed: Vec<RemovedGroup>,
        }

        let inner = OldGroupChats::deserialize(deserializer)?;
        let Timestamped { value, timestamp } = inner.pinned;
        Ok(GroupChats {
            groups_created: inner.groups_created,
            group_chats: inner.group_chats,
            pinned: Timestamped::new(value.into_iter().map(|id| (id, 0)).collect(), timestamp),
            removed: inner.removed,
        })
    }
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

    pub fn pinned(&self) -> &HashMap<ChatId, TimestampMillis> {
        &self.pinned.value
    }

    pub fn pinned_if_updated(&self, since: TimestampMillis) -> Option<HashMap<ChatId, TimestampMillis>> {
        self.pinned.if_set_after(since).map(|ids| ids.to_owned())
    }

    pub fn removed_since(&self, timestamp: TimestampMillis) -> Vec<ChatId> {
        self.removed
            .iter()
            .rev()
            .take_while(|g| g.timestamp > timestamp)
            .map(|g| g.chat_id)
            .collect()
    }

    pub fn get_mut(&mut self, chat_id: &ChatId) -> Option<&mut GroupChat> {
        self.group_chats.get_mut(chat_id)
    }

    pub fn any_updated(&self, since: TimestampMillis) -> bool {
        self.group_chats.values().any(|c| c.last_updated() > since)
            || self.pinned.timestamp > since
            || self.removed.last().map(|g| g.timestamp > since).unwrap_or_default()
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
                self.removed.retain(|g| g.chat_id != chat_id);
                true
            }
            Occupied(_) => false,
        }
    }

    pub fn remove(&mut self, chat_id: ChatId, now: TimestampMillis) -> Option<GroupChat> {
        self.removed.retain(|g| g.chat_id != chat_id);
        self.removed.push(RemovedGroup { chat_id, timestamp: now });
        self.group_chats.remove(&chat_id)
    }

    pub fn iter(&self) -> impl Iterator<Item = &GroupChat> {
        self.group_chats.values()
    }

    pub fn groups_created(&self) -> u32 {
        self.groups_created
    }

    pub fn len(&self) -> usize {
        self.group_chats.len()
    }

    pub fn removed_len(&self) -> usize {
        self.removed.len()
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
