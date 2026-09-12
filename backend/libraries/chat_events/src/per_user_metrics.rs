use crate::metrics::ChatMetricsInternal;
use candid::Principal;
use serde::{Deserialize, Serialize};
use stable_memory_map::{Key, KeyPrefix, UserMetricsKeyPrefix, with_map, with_map_mut};
use std::cmp::{max, min};
use std::collections::BTreeMap;
use types::{Chat, ChatId, TimestampMillis, UserId};

// Each user's metrics within a chat. The entries are stored in the stable memory map for small
// entries.
//
// A User canister only ever reads its own user's metrics for a direct chat, so the other user's
// metrics can be skipped (see `skip_their_metrics`).
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
        if let Some(metrics) = self.on_heap.get(user_id) {
            return Some(metrics.clone());
        }

        let key = UserMetricsKeyPrefix::new_from_chat(chat).create_key(user_id);
        with_map(|m| m.get(key)).map(|bytes| ChatMetricsInternal::from_bytes(&bytes))
    }

    pub fn update<F: FnOnce(&mut ChatMetricsInternal)>(
        &mut self,
        chat: Chat,
        skip_their_metrics: bool,
        user_id: UserId,
        action: F,
        timestamp: TimestampMillis,
    ) {
        if skip_their_metrics && is_them(chat, user_id) {
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

    // Called with the user whose canister holds this direct chat. Their metrics are the only ones
    // which are ever read, so the other user's metrics can be skipped, unless the chat is the user's
    // chat with themselves, in which case the other user *is* the canister's user. Returns whether
    // the other user's metrics should be skipped, in which case any already stored are deleted.
    pub fn skip_their_metrics(&mut self, chat: Chat, my_user_id: UserId) -> bool {
        let Chat::Direct(them) = chat else {
            return false;
        };
        let them = UserId::from(them);
        if them == my_user_id {
            return false;
        }

        self.on_heap.remove(&them);
        with_map_mut(|m| m.remove(UserMetricsKeyPrefix::new_from_chat(chat).create_key(&them)));
        true
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
    // moved. Any existing entry in stable memory for one of these users is a copy of the heap entry
    // (see `copy_to_heap`), so it can simply be overwritten.
    pub fn migrate_to_stable_memory(&mut self, chat: Chat, max_count: usize) -> usize {
        let prefix = UserMetricsKeyPrefix::new_from_chat(chat);
        let count = min(max_count, self.on_heap.len());
        let mut entries = Vec::with_capacity(count);
        for (user_id, metrics) in std::iter::from_fn(|| self.on_heap.pop_first()).take(count) {
            entries.push((prefix.create_key(&user_id), metrics.to_bytes()));
        }

        // User ids are ordered by length before their bytes, whereas keys are ordered by their bytes
        // alone, so sort the entries into key order to minimise the number of nodes written
        entries.sort_unstable_by(|(k1, _), (k2, _)| k1.cmp(k2));
        with_map_mut(|m| m.insert_many(entries));
        count
    }

    pub fn on_heap_count(&self) -> usize {
        self.on_heap.len()
    }
}

fn is_them(chat: Chat, user_id: UserId) -> bool {
    matches!(chat, Chat::Direct(them) if them == ChatId::from(user_id))
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

            apply(&mut metrics1, &mut model1, chat1, false, user_id, key, incr, now);
            apply(&mut metrics2, &mut model2, chat2, false, user_id, key, !incr, now + 1000);
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
        apply(
            &mut metrics,
            &mut model,
            chat,
            false,
            user_id(10),
            MetricKey::Reactions,
            true,
            5000,
        );
        apply(
            &mut metrics,
            &mut model,
            chat,
            false,
            user_id(100),
            MetricKey::Reactions,
            true,
            5000,
        );
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
            apply(
                &mut metrics,
                &mut model,
                group,
                false,
                user_id,
                MetricKey::TextMessages,
                true,
                now,
            );
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
        apply(
            &mut metrics,
            &mut model,
            group,
            false,
            user_id(3),
            MetricKey::Edits,
            true,
            2000,
        );
        assert_matches_model(&metrics, group, &model);
        metrics.migrate_to_stable_memory(group, usize::MAX);
        assert_matches_model(&metrics, group, &model);
    }

    #[test]
    fn other_users_metrics_are_skipped_in_direct_chats() {
        init_stable_memory_map();
        let me = user_id(1);
        let them = user_id(2);
        let chat = Chat::Direct(them.into());
        let group = Chat::Group(Principal::anonymous().into());
        let mut metrics = PerUserMetrics::default();
        let mut group_metrics = PerUserMetrics::default();
        let mut model = Model::new();
        let mut group_model = Model::new();

        // Until the chat knows whose canister holds it, every user's metrics are stored
        apply(&mut metrics, &mut model, chat, false, me, MetricKey::TextMessages, true, 1000);
        apply(
            &mut metrics,
            &mut model,
            chat,
            false,
            them,
            MetricKey::TextMessages,
            true,
            1000,
        );
        apply(
            &mut group_metrics,
            &mut group_model,
            group,
            false,
            them,
            MetricKey::TextMessages,
            true,
            1000,
        );
        assert_matches_model(&metrics, chat, &model);

        // Once it does, the other user's metrics are deleted
        assert!(metrics.skip_their_metrics(chat, me));
        model.remove(&them);
        assert!(metrics.get(chat, &them).is_none());
        assert_matches_model(&metrics, chat, &model);

        // And they are no longer stored
        for now in 1001..1100 {
            let key = MetricKey::from((rng().next_u32() % 22 + 1) as u8);
            apply(&mut metrics, &mut model, chat, true, me, key, true, now);
            metrics.update(chat, true, them, |m| m.incr(key, 1), now);
        }
        assert!(metrics.get(chat, &them).is_none());
        assert_matches_model(&metrics, chat, &model);
        assert_eq!(stable_user_ids(chat), vec![me]);

        // The other user's metrics in other chats are unaffected
        assert_matches_model(&group_metrics, group, &group_model);
    }

    #[test]
    fn metrics_are_stored_in_self_chats() {
        init_stable_memory_map();
        let me = user_id(1);
        let chat = Chat::Direct(me.into());
        let mut metrics = PerUserMetrics::default();
        let mut model = Model::new();

        apply(&mut metrics, &mut model, chat, false, me, MetricKey::TextMessages, true, 1000);

        // In a user's chat with themselves, the other user is the user whose canister holds the chat,
        // so nothing is skipped or deleted
        assert!(!metrics.skip_their_metrics(chat, me));
        assert_matches_model(&metrics, chat, &model);

        for now in 1001..1100 {
            let key = MetricKey::from((rng().next_u32() % 22 + 1) as u8);
            apply(&mut metrics, &mut model, chat, false, me, key, true, now);
        }
        assert_matches_model(&metrics, chat, &model);
        assert_eq!(stable_user_ids(chat), vec![me]);
    }

    #[test]
    fn metrics_are_not_skipped_in_group_chats_or_channels() {
        let me = user_id(1);
        let mut metrics = PerUserMetrics::default();

        assert!(!metrics.skip_their_metrics(Chat::Group(Principal::anonymous().into()), me));
        assert!(!metrics.skip_their_metrics(Chat::Channel(Principal::anonymous().into(), ChannelId::from(1u32)), me));
    }

    #[test]
    fn other_users_legacy_metrics_are_deleted_when_skipped() {
        init_stable_memory_map();
        let me = user_id(2);

        // Where the other user's legacy entry has already been moved into stable memory, it is
        // deleted from there
        let them = user_id(1);
        let chat = Chat::Direct(them.into());
        let (mut metrics, mut model) = legacy_metrics(&[them, me]);
        assert_eq!(metrics.migrate_to_stable_memory(chat, 1), 1);
        assert_eq!(stable_user_ids(chat), vec![them]);

        assert!(metrics.skip_their_metrics(chat, me));
        model.remove(&them);
        assert!(stable_user_ids(chat).is_empty());
        assert_matches_model(&metrics, chat, &model);

        assert_eq!(metrics.migrate_to_stable_memory(chat, usize::MAX), 1);
        assert_eq!(stable_user_ids(chat), vec![me]);
        assert_matches_model(&metrics, chat, &model);

        // Where it is still on the heap, it is dropped rather than moved into stable memory
        let them = user_id(3);
        let chat = Chat::Direct(them.into());
        let (mut metrics, mut model) = legacy_metrics(&[them, me]);

        assert!(metrics.skip_their_metrics(chat, me));
        model.remove(&them);
        assert_eq!(metrics.on_heap_count(), 1);
        assert_matches_model(&metrics, chat, &model);

        assert_eq!(metrics.migrate_to_stable_memory(chat, usize::MAX), 1);
        assert_eq!(stable_user_ids(chat), vec![me]);
        assert_matches_model(&metrics, chat, &model);
    }

    #[allow(clippy::too_many_arguments)]
    fn apply(
        metrics: &mut PerUserMetrics,
        model: &mut Model,
        chat: Chat,
        skip_their_metrics: bool,
        user_id: UserId,
        key: MetricKey,
        incr: bool,
        now: TimestampMillis,
    ) {
        let action = |m: &mut ChatMetricsInternal| {
            if incr { m.incr(key, 1) } else { m.decr(key, 1) }
        };
        metrics.update(chat, skip_their_metrics, user_id, action, now);

        let expected = model.entry(user_id).or_default();
        action(expected);
        expected.last_active = max(expected.last_active, now);
    }

    fn assert_matches_model(metrics: &PerUserMetrics, chat: Chat, model: &Model) {
        for (user_id, expected) in model {
            assert_eq!(metrics.get(chat, user_id).as_ref(), Some(expected));
        }
    }

    // Deserializes entries on the heap, as they were held before being moved into stable memory
    fn legacy_metrics(user_ids: &[UserId]) -> (PerUserMetrics, Model) {
        let mut model = Model::new();
        for (i, user_id) in user_ids.iter().enumerate() {
            let mut metrics = ChatMetricsInternal::default();
            metrics.incr(MetricKey::TextMessages, i as u32 + 1);
            model.insert(*user_id, metrics);
        }
        (
            msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&model)),
            model,
        )
    }

    fn stable_user_ids(chat: Chat) -> Vec<UserId> {
        let prefix = UserMetricsKeyPrefix::new_from_chat(chat);
        with_map(|m| {
            m.range(prefix.create_key(&Principal::from_slice(&[]).into())..)
                .take_while(|(k, _)| k.matches_prefix(&prefix))
                .map(|(k, _)| k.user_id())
                .collect()
        })
    }

    fn user_id(i: u32) -> UserId {
        Principal::from_slice(&i.to_be_bytes()).into()
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
