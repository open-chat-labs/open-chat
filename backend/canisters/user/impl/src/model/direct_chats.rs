use crate::model::direct_chat::DirectChat;
use chat_events::{ChatInternal, ChatMetricsInternal};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use types::{ChatId, MessageIndex, TimestampMillis, Timestamped, UserId, UserType};

#[derive(Serialize, Deserialize, Default)]
pub struct DirectChats {
    direct_chats: HashMap<ChatId, DirectChat>,
    pinned: Timestamped<Vec<ChatId>>,
    metrics: ChatMetricsInternal,
    chats_removed: BTreeSet<(TimestampMillis, ChatId)>,
    // This is needed so that when a group is imported into a community we can quickly update the
    // replies to point to the community
    #[serde(default)]
    private_replies_to_groups: BTreeMap<ChatId, Vec<(UserId, MessageIndex)>>,
}

impl DirectChats {
    pub fn get(&self, chat_id: &ChatId) -> Option<&DirectChat> {
        self.direct_chats.get(chat_id)
    }

    pub fn get_mut(&mut self, chat_id: &ChatId) -> Option<&mut DirectChat> {
        self.direct_chats.get_mut(chat_id)
    }

    pub fn get_or_create<F: FnOnce() -> u128>(
        &mut self,
        their_user_id: UserId,
        their_user_type: UserType,
        anonymized_id: F,
        now: TimestampMillis,
    ) -> &mut DirectChat {
        self.direct_chats
            .entry(their_user_id.into())
            .or_insert_with(|| DirectChat::new(their_user_id, their_user_type, None, anonymized_id(), now))
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
            || self.chats_removed.last().is_some_and(|(ts, _)| *ts > since)
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

    pub fn mark_private_reply(&mut self, user_id: UserId, chat: ChatInternal, message_index: MessageIndex) {
        if let ChatInternal::Group(chat_id) = chat {
            self.private_replies_to_groups
                .entry(chat_id)
                .or_default()
                .push((user_id, message_index));
        }
    }

    pub fn migrate_replies(&mut self, old: ChatInternal, new: ChatInternal, now: TimestampMillis) {
        if let ChatInternal::Group(chat_id) = old {
            if let Some(replies) = self.private_replies_to_groups.remove(&chat_id) {
                for (user_id, message_index) in replies {
                    if let Some(chat) = self.direct_chats.get_mut(&user_id.into()) {
                        chat.events.migrate_reply(message_index, old, new, now);
                    }
                }
            }
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
