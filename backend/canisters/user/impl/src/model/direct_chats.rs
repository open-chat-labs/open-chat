use crate::model::direct_chat::DirectChat;
use chat_events::{ChatInternal, ChatMetricsInternal};
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Vacant;
use std::collections::{BTreeSet, HashMap};
use types::{ChatId, TimestampMillis, Timestamped, UserId, UserType};

#[derive(Serialize, Deserialize, Default)]
pub struct DirectChats {
    direct_chats: HashMap<ChatId, DirectChat>,
    pinned: Timestamped<Vec<ChatId>>,
    metrics: ChatMetricsInternal,
    chats_removed: BTreeSet<(TimestampMillis, ChatId)>,
}

impl DirectChats {
    pub fn get(&self, chat_id: &ChatId) -> Option<&DirectChat> {
        self.direct_chats.get(chat_id)
    }

    pub fn get_mut(&mut self, chat_id: &ChatId) -> Option<&mut DirectChat> {
        self.direct_chats.get_mut(chat_id)
    }

    pub fn create(
        &mut self,
        their_user_id: UserId,
        their_user_type: UserType,
        anonymized_id: u128,
        now: TimestampMillis,
    ) -> &mut DirectChat {
        if let Vacant(e) = self.direct_chats.entry(their_user_id.into()) {
            e.insert(DirectChat::new(their_user_id, their_user_type, None, anonymized_id, now))
        } else {
            unreachable!()
        }
    }

    pub fn updated_since(&self, since: TimestampMillis) -> impl Iterator<Item = &DirectChat> {
        self.direct_chats.values().filter(move |c| c.has_updates_since(since))
    }

    pub fn removed_since(&self, since: TimestampMillis) -> Vec<ChatId> {
        self.chats_removed
            .iter()
            .rev()
            .take_while(|(ts, _)| *ts > since)
            .map(|(_, c)| *c)
            .collect()
    }

    pub fn pinned(&self) -> &Vec<ChatId> {
        &self.pinned.value
    }

    pub fn pinned_if_updated(&self, since: TimestampMillis) -> Option<Vec<ChatId>> {
        self.pinned.if_set_after(since).map(|ids| ids.to_vec())
    }

    pub fn any_updated(&self, since: TimestampMillis) -> bool {
        self.direct_chats.values().any(|c| c.has_updates_since(since))
            || self.pinned.timestamp > since
            || self.chats_removed.last().map_or(false, |(ts, _)| *ts > since)
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

    pub fn migrate_replies(&mut self, old: ChatInternal, new: ChatInternal, now: TimestampMillis) {
        for chat in self.direct_chats.values_mut() {
            chat.events.migrate_replies(old, new, now);
        }
    }

    pub fn aggregate_metrics(&mut self) {
        let mut metrics = ChatMetricsInternal::default();

        for chat in self.direct_chats.values() {
            metrics.merge(chat.events.metrics());
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
        if !self.pinned.value.contains(&chat_id) {
            self.pinned.timestamp = now;
            self.pinned.value.insert(0, chat_id);
        }
    }

    pub fn unpin(&mut self, chat_id: &ChatId, now: TimestampMillis) {
        if self.pinned.value.contains(chat_id) {
            self.pinned.timestamp = now;
            self.pinned.value.retain(|pinned_chat_id| pinned_chat_id != chat_id);
        }
    }

    pub fn remove(&mut self, chat_id: ChatId, now: TimestampMillis) -> Option<DirectChat> {
        if let Some(chat) = self.direct_chats.remove(&chat_id) {
            self.chats_removed.insert((now, chat_id));
            Some(chat)
        } else {
            None
        }
    }
}
