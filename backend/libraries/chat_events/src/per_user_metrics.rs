use crate::metrics::ChatMetricsInternal;
use candid::Principal;
use serde::{Deserialize, Serialize};
use stable_memory_map::{Key, KeyPrefix, UserMetricsKeyPrefix, with_map, with_map_mut};
use std::cmp::max;
use std::collections::BTreeMap;
use types::{Chat, ChatId, TimestampMillis, UserId};

// Each user's metrics within a chat. The entries are stored in the stable memory map for small
// entries.
//
// In a direct chat, only the metrics of the user whose canister holds the chat are ever read, so
// the other user's metrics aren't stored.
#[derive(Serialize, Deserialize, Default)]
#[serde(transparent)]
pub struct PerUserMetrics {
    // Entries which haven't yet been moved into stable memory. New entries are always written to
    // stable memory, and existing ones are moved across in batches by `migrate_to_stable_memory`.
    // This can be removed once every chat has been migrated. It is always serialized, which is also
    // how the metrics are carried over when a group is imported into a community.
    //
    // A user with an entry here has no entry in stable memory, unless the entries in stable memory
    // have been copied here by `copy_to_heap`, in which case both entries are the same.
    on_heap: BTreeMap<UserId, ChatMetricsInternal>,
}

impl PerUserMetrics {
    pub fn get(&self, chat: Chat, user_id: &UserId) -> Option<ChatMetricsInternal> {
        if !is_stored(chat, user_id) {
            return None;
        }

        if let Some(metrics) = self.on_heap.get(user_id) {
            return Some(metrics.clone());
        }

        let key = UserMetricsKeyPrefix::new_from_chat(chat).create_key(user_id);
        with_map(|m| m.get(key)).map(|bytes| ChatMetricsInternal::from_bytes(&bytes))
    }

    pub fn update<F: FnOnce(&mut ChatMetricsInternal)>(
        &mut self,
        chat: Chat,
        user_id: UserId,
        action: F,
        timestamp: TimestampMillis,
    ) {
        if !is_stored(chat, &user_id) {
            return;
        }

        let key = UserMetricsKeyPrefix::new_from_chat(chat).create_key(&user_id);

        with_map_mut(|m| {
            let mut metrics = self.on_heap.remove(&user_id).unwrap_or_else(|| {
                m.get(key.clone())
                    .map(|bytes| ChatMetricsInternal::from_bytes(&bytes))
                    .unwrap_or_default()
            });
            action(&mut metrics);
            metrics.last_active = max(metrics.last_active, timestamp);
            m.insert(key, metrics.to_bytes());
        });
    }

    // Copies every entry in stable memory onto the heap, so that they are included when the chat is
    // serialized to be imported into a community
    pub fn copy_to_heap(&mut self, chat: Chat) {
        let prefix = UserMetricsKeyPrefix::new_from_chat(chat);
        let start = prefix.create_key(&Principal::from_slice(&[]).into());

        with_map(|m| {
            for (key, bytes) in m.range(start..).take_while(|(k, _)| k.matches_prefix(&prefix)) {
                self.on_heap.insert(key.user_id(), ChatMetricsInternal::from_bytes(&bytes));
            }
        });
    }

    // Moves up to `max_count` entries from the heap into stable memory, returning how many were
    // moved. Entries for the other user in a direct chat are dropped rather than moved.
    pub fn migrate_to_stable_memory(&mut self, chat: Chat, max_count: usize) -> usize {
        let prefix = UserMetricsKeyPrefix::new_from_chat(chat);
        let mut count = 0;

        with_map_mut(|m| {
            while count < max_count
                && let Some((user_id, metrics)) = self.on_heap.pop_first()
            {
                if is_stored(chat, &user_id) {
                    m.insert(prefix.create_key(&user_id), metrics.to_bytes());
                }
                count += 1;
            }
        });
        count
    }

    pub fn on_heap_count(&self) -> usize {
        self.on_heap.len()
    }
}

fn is_stored(chat: Chat, user_id: &UserId) -> bool {
    !matches!(chat, Chat::Direct(them) if them == ChatId::from(*user_id))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::metrics::MetricKey;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use rand::{Rng, rng};
    use types::ChannelId;

    type Model = BTreeMap<UserId, ChatMetricsInternal>;

    #[test]
    fn metrics_are_stored_per_chat() {
        init_stable_memory_map();
        let chat1 = Chat::Channel(Principal::anonymous().into(), ChannelId::from(1u32));
        let chat2 = Chat::Channel(Principal::anonymous().into(), ChannelId::from(2u32));
        let mut metrics1 = PerUserMetrics::default();
        let mut metrics2 = PerUserMetrics::default();
        let mut model1 = Model::new();
        let mut model2 = Model::new();

        for now in 1000..1500 {
            let user_id = user_id(rng().next_u32() % 20);
            let key = MetricKey::from((rng().next_u32() % 22 + 1) as u8);
            let incr = !rng().next_u32().is_multiple_of(3);

            apply(&mut metrics1, &mut model1, chat1, user_id, key, incr, now);
            apply(&mut metrics2, &mut model2, chat2, user_id, key, !incr, now + 1000);
        }

        assert_eq!(metrics1.on_heap_count(), 0);
        assert_matches_model(&metrics1, chat1, &model1);
        assert_matches_model(&metrics2, chat2, &model2);
        assert!(metrics1.get(chat1, &user_id(100)).is_none());
    }

    #[test]
    fn heap_entries_are_migrated_to_stable_memory() {
        init_stable_memory_map();
        let chat = Chat::Group(Principal::anonymous().into());
        let mut model = Model::new();

        // Build up some legacy entries on the heap
        for i in 0..50 {
            let mut metrics = ChatMetricsInternal::default();
            metrics.last_active = 1000 + i as u64;
            metrics.incr(MetricKey::TextMessages, i + 1);
            model.insert(user_id(i), metrics);
        }
        let bytes = msgpack::serialize_then_unwrap(&model);
        let mut metrics: PerUserMetrics = msgpack::deserialize_then_unwrap(&bytes);
        // The legacy entries are serialized the same way as the map they were previously held in
        assert_eq!(msgpack::serialize_then_unwrap(&metrics), bytes);
        assert_eq!(metrics.on_heap_count(), 50);
        assert_matches_model(&metrics, chat, &model);

        // Updating a user moves their entry into stable memory
        apply(&mut metrics, &mut model, chat, user_id(10), MetricKey::Reactions, true, 5000);
        apply(&mut metrics, &mut model, chat, user_id(100), MetricKey::Reactions, true, 5000);
        assert_eq!(metrics.on_heap_count(), 49);
        assert_matches_model(&metrics, chat, &model);

        assert_eq!(metrics.migrate_to_stable_memory(chat, 20), 20);
        assert_eq!(metrics.on_heap_count(), 29);
        assert_matches_model(&metrics, chat, &model);

        assert_eq!(metrics.migrate_to_stable_memory(chat, 100), 29);
        assert_eq!(metrics.on_heap_count(), 0);
        assert_matches_model(&metrics, chat, &model);
    }

    #[test]
    fn metrics_survive_being_imported_into_a_community() {
        init_stable_memory_map();
        let group = Chat::Group(Principal::anonymous().into());
        let channel = Chat::Channel(Principal::from_slice(&[1]).into(), ChannelId::from(1u32));
        let mut model = Model::new();

        let mut legacy = Model::new();
        for i in 0..10 {
            let mut metrics = ChatMetricsInternal::default();
            metrics.incr(MetricKey::Polls, i + 1);
            legacy.insert(user_id(i), metrics.clone());
            model.insert(user_id(i), metrics);
        }
        let mut metrics: PerUserMetrics = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(legacy));

        for now in 1000..1200 {
            let user_id = user_id(rng().next_u32() % 30);
            apply(&mut metrics, &mut model, group, user_id, MetricKey::TextMessages, true, now);
        }

        // The group copies its entries onto the heap before serializing them
        metrics.copy_to_heap(group);
        assert_eq!(metrics.on_heap_count(), model.len());
        assert_matches_model(&metrics, group, &model);

        // The community deserializes them then moves them into stable memory under the channel
        let bytes = msgpack::serialize_then_unwrap(&metrics);
        let mut imported: PerUserMetrics = msgpack::deserialize_then_unwrap(&bytes);
        assert_matches_model(&imported, channel, &model);
        assert_eq!(imported.migrate_to_stable_memory(channel, usize::MAX), model.len());
        assert_matches_model(&imported, channel, &model);

        // If the import is abandoned, the group's copies on the heap are the same as the entries in
        // stable memory, so it can carry on as before
        apply(&mut metrics, &mut model, group, user_id(3), MetricKey::Edits, true, 2000);
        assert_matches_model(&metrics, group, &model);
        metrics.migrate_to_stable_memory(group, usize::MAX);
        assert_matches_model(&metrics, group, &model);
    }

    #[test]
    fn other_users_metrics_are_not_stored_in_direct_chats() {
        init_stable_memory_map();
        let me = user_id(1);
        let them = user_id(2);
        let other = user_id(3);
        let chat = Chat::Direct(them.into());
        let mut model = Model::new();

        // Legacy entries on the heap for both users
        let mut legacy = Model::new();
        for user_id in [me, them] {
            let mut metrics = ChatMetricsInternal::default();
            metrics.incr(MetricKey::TextMessages, 5);
            legacy.insert(user_id, metrics);
        }
        model.insert(me, legacy[&me].clone());
        let mut metrics: PerUserMetrics = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(legacy));
        assert!(metrics.get(chat, &them).is_none());

        for now in 1000..1100 {
            for user_id in [me, them, other] {
                let key = MetricKey::from((rng().next_u32() % 22 + 1) as u8);
                if user_id == them {
                    metrics.update(chat, user_id, |m| m.incr(key, 1), now);
                } else {
                    apply(&mut metrics, &mut model, chat, user_id, key, true, now);
                }
            }
        }
        assert!(metrics.get(chat, &them).is_none());
        assert_matches_model(&metrics, chat, &model);

        // The other user's legacy entry is dropped rather than moved into stable memory
        assert_eq!(metrics.on_heap_count(), 1);
        assert_eq!(metrics.migrate_to_stable_memory(chat, usize::MAX), 1);
        assert_eq!(metrics.on_heap_count(), 0);
        assert!(metrics.get(chat, &them).is_none());
        assert_matches_model(&metrics, chat, &model);

        metrics.copy_to_heap(chat);
        assert_eq!(metrics.on_heap_count(), 2);
        let prefix = UserMetricsKeyPrefix::new_from_chat(chat);
        let stable_user_ids: Vec<_> = with_map(|m| {
            m.range(prefix.create_key(&Principal::from_slice(&[]).into())..)
                .take_while(|(k, _)| k.matches_prefix(&prefix))
                .map(|(k, _)| k.user_id())
                .collect()
        });
        assert_eq!(stable_user_ids, vec![me, other]);
    }

    fn apply(
        metrics: &mut PerUserMetrics,
        model: &mut Model,
        chat: Chat,
        user_id: UserId,
        key: MetricKey,
        incr: bool,
        now: TimestampMillis,
    ) {
        let action = |m: &mut ChatMetricsInternal| {
            if incr { m.incr(key, 1) } else { m.decr(key, 1) }
        };
        metrics.update(chat, user_id, action, now);

        let expected = model.entry(user_id).or_default();
        action(expected);
        expected.last_active = max(expected.last_active, now);
    }

    fn assert_matches_model(metrics: &PerUserMetrics, chat: Chat, model: &Model) {
        for (user_id, expected) in model {
            assert_eq!(metrics.get(chat, user_id).as_ref(), Some(expected));
        }
    }

    fn user_id(i: u32) -> UserId {
        Principal::from_slice(&i.to_be_bytes()).into()
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
