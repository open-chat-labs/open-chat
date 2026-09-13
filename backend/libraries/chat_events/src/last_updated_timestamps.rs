use constants::calculate_summary_updates_data_removal_cutoff;
use serde::{Deserialize, Serialize};
use stable_memory_map::{EventLastUpdatedKeyPrefix, EventsByLastUpdatedKeyPrefix, KeyPrefix, with_map, with_map_mut};
use std::cmp::{Reverse, max};
use std::collections::{BTreeMap, BTreeSet};
use types::{Chat, EventIndex, MAX_EVENT_INDEX, MIN_EVENT_INDEX, MessageIndex, TimestampMillis};

// The maximum number of expired entries to remove from stable memory each time an event is marked
// as updated, so that the cost of marking an event as updated stays bounded
const MAX_STABLE_MEMORY_ENTRIES_TO_PRUNE: usize = 100;

// When each event (including events in threads) was last updated. The entries are stored in the
// stable memory map for small entries, both keyed by event and ordered by timestamp.
#[derive(Serialize, Deserialize, Default)]
#[serde(from = "LastUpdatedTimestampsTrimmed")]
pub struct LastUpdatedTimestamps {
    // Entries which haven't yet been moved into stable memory. New entries are always written to
    // stable memory, and existing ones are moved across in batches by `migrate_to_stable_memory`.
    // This can be removed once every chat has been migrated. It is always serialized so that a
    // canister can still be rolled back to a version expecting it.
    //
    // An event with an entry here has no entry in stable memory, since marking an event as updated
    // removes its entry from here before writing to stable memory.
    by_timestamp: BTreeSet<(TimestampMillis, Option<MessageIndex>, EventIndex)>,
    #[serde(skip)]
    by_event_index: BTreeMap<(Option<MessageIndex>, EventIndex), TimestampMillis>,
    latest_update_removed: TimestampMillis,
    // The most recent time that any event was marked as updated, which is always at least as
    // recent as every entry, so that it can be read without reading from stable memory
    #[serde(rename = "l", default, skip_serializing_if = "Option::is_none")]
    latest_update: Option<TimestampMillis>,
}

impl LastUpdatedTimestamps {
    pub fn mark_updated(
        &mut self,
        chat: Chat,
        thread_root_message_index: Option<MessageIndex>,
        event_index: EventIndex,
        now: TimestampMillis,
    ) {
        self.prune(chat, now);

        if let Some(previous) = self.by_event_index.remove(&(thread_root_message_index, event_index)) {
            self.by_timestamp.remove(&(previous, thread_root_message_index, event_index));
        }
        insert_into_stable_memory(chat, thread_root_message_index, event_index, now);
        self.latest_update = max(self.latest_update, Some(now));
    }

    // The events which were last updated after `since`, most recently updated first
    pub fn recently_updated_events(
        &self,
        chat: Chat,
        since: TimestampMillis,
        max_count: usize,
    ) -> Vec<(Option<MessageIndex>, EventIndex, TimestampMillis)> {
        let Some(from) = since.checked_add(1) else {
            return Vec::new();
        };
        if self.latest_update.is_none_or(|ts| ts < from) {
            return Vec::new();
        }

        let prefix = EventsByLastUpdatedKeyPrefix::new_from_chat(chat);
        let start = prefix.create_key(&(from, None, MIN_EVENT_INDEX));
        let end = prefix.create_key(&(TimestampMillis::MAX, Some(u32::MAX.into()), MAX_EVENT_INDEX));
        let mut events: Vec<_> = with_map(|m| {
            m.range(start..=end)
                .rev()
                .take(max_count)
                .map(|(k, _)| (k.thread_root_message_index(), k.event_index(), k.last_updated()))
                .collect()
        });

        if !self.by_timestamp.is_empty() {
            events.extend(
                self.by_timestamp
                    .range((from, None, MIN_EVENT_INDEX)..)
                    .rev()
                    .take(max_count)
                    .map(|(ts, r, e)| (*r, *e, *ts)),
            );
            events.sort_unstable_by_key(|(r, e, ts)| Reverse((*ts, *r, *e)));
            events.truncate(max_count);
        }
        events
    }

    pub fn last_updated(
        &self,
        chat: Chat,
        thread_root_message_index: Option<MessageIndex>,
        event_index: EventIndex,
    ) -> Option<TimestampMillis> {
        if let Some(ts) = self.by_event_index.get(&(thread_root_message_index, event_index)) {
            return Some(*ts);
        }
        self.latest_update?;

        let key = EventLastUpdatedKeyPrefix::new_from_chat(chat).create_key(&(thread_root_message_index, event_index));
        with_map(|m| m.get(key)).map(|bytes| bytes_to_timestamp(&bytes))
    }

    pub fn latest_update(&self) -> Option<TimestampMillis> {
        self.latest_update
    }

    pub fn latest_update_removed(&self) -> TimestampMillis {
        self.latest_update_removed
    }

    // Moves up to `max_count` entries from the heap into stable memory, returning how many were
    // moved
    pub fn migrate_to_stable_memory(&mut self, chat: Chat, max_count: usize) -> usize {
        let mut batch = Vec::new();
        while batch.len() < max_count
            && let Some((ts, thread_root_message_index, event_index)) = self.by_timestamp.pop_first()
        {
            self.by_event_index.remove(&(thread_root_message_index, event_index));
            batch.push((ts, thread_root_message_index, event_index));
        }
        let count = batch.len();
        if count == 0 {
            return 0;
        }

        // None of these events have entries in stable memory, so there are no previous entries to
        // remove and the entries can be inserted in bulk
        let by_event_prefix = EventLastUpdatedKeyPrefix::new_from_chat(chat);
        let by_timestamp_prefix = EventsByLastUpdatedKeyPrefix::new_from_chat(chat);

        with_map_mut(|m| {
            // The batch is in timestamp order, which is the key order of the entries keyed by timestamp
            m.insert_many(
                batch
                    .iter()
                    .map(|&(ts, tr, e)| (by_timestamp_prefix.create_key(&(ts, tr, e)), Vec::new())),
            );
            batch.sort_unstable_by_key(|&(_, tr, e)| (tr, e));
            m.insert_many(
                batch
                    .into_iter()
                    .map(|(ts, tr, e)| (by_event_prefix.create_key(&(tr, e)), ts.to_be_bytes().to_vec())),
            );
        });
        count
    }

    pub fn on_heap_count(&self) -> usize {
        self.by_timestamp.len()
    }

    // Removes the entries which are too old to be included in summary updates. Only a limited
    // number of entries are removed from stable memory at a time, any remaining entries are
    // removed by subsequent calls.
    fn prune(&mut self, chat: Chat, now: TimestampMillis) {
        let cutoff = calculate_summary_updates_data_removal_cutoff(now);

        let still_valid = self.by_timestamp.split_off(&(cutoff, None, MIN_EVENT_INDEX));
        let removed = std::mem::replace(&mut self.by_timestamp, still_valid);

        if let Some((ts, _, _)) = removed.last() {
            self.latest_update_removed = max(self.latest_update_removed, *ts);
        }
        for (_, tr, e) in removed {
            self.by_event_index.remove(&(tr, e));
        }

        let by_event_prefix = EventLastUpdatedKeyPrefix::new_from_chat(chat);
        let by_timestamp_prefix = EventsByLastUpdatedKeyPrefix::new_from_chat(chat);
        let start = by_timestamp_prefix.create_key(&(TimestampMillis::MIN, None, MIN_EVENT_INDEX));
        let end = by_timestamp_prefix.create_key(&(cutoff, None, MIN_EVENT_INDEX));

        with_map_mut(|m| {
            let expired: Vec<_> = m
                .range(start..end)
                .take(MAX_STABLE_MEMORY_ENTRIES_TO_PRUNE)
                .map(|(k, _)| k)
                .collect();

            for key in expired {
                self.latest_update_removed = max(self.latest_update_removed, key.last_updated());
                m.remove(by_event_prefix.create_key(&(key.thread_root_message_index(), key.event_index())));
                m.remove(key);
            }
        });
    }
}

// Each event has an entry keyed by the event, whose value is the time it was last updated, plus an
// entry keyed by that time, so that the most recently updated events can be iterated over
fn insert_into_stable_memory(
    chat: Chat,
    thread_root_message_index: Option<MessageIndex>,
    event_index: EventIndex,
    ts: TimestampMillis,
) {
    let by_event_key = EventLastUpdatedKeyPrefix::new_from_chat(chat).create_key(&(thread_root_message_index, event_index));
    let by_timestamp_prefix = EventsByLastUpdatedKeyPrefix::new_from_chat(chat);

    with_map_mut(|m| {
        if let Some(previous) = m.insert(by_event_key, ts.to_be_bytes().to_vec()) {
            m.remove(by_timestamp_prefix.create_key(&(bytes_to_timestamp(&previous), thread_root_message_index, event_index)));
        }
        m.insert(
            by_timestamp_prefix.create_key(&(ts, thread_root_message_index, event_index)),
            Vec::new(),
        );
    });
}

fn bytes_to_timestamp(bytes: &[u8]) -> TimestampMillis {
    TimestampMillis::from_be_bytes(bytes.try_into().unwrap())
}

#[derive(Deserialize)]
pub struct LastUpdatedTimestampsTrimmed {
    by_timestamp: BTreeSet<(TimestampMillis, Option<MessageIndex>, EventIndex)>,
    #[serde(default)]
    latest_update_removed: TimestampMillis,
    #[serde(rename = "l", default)]
    latest_update: Option<TimestampMillis>,
}

impl From<LastUpdatedTimestampsTrimmed> for LastUpdatedTimestamps {
    fn from(value: LastUpdatedTimestampsTrimmed) -> Self {
        let mut by_event_index = BTreeMap::new();
        for (ts, tr, e) in value.by_timestamp.iter() {
            by_event_index.insert((*tr, *e), *ts);
        }
        let latest_on_heap = value.by_timestamp.last().map(|(ts, _, _)| *ts);

        LastUpdatedTimestamps {
            by_timestamp: value.by_timestamp,
            by_event_index,
            latest_update_removed: value.latest_update_removed,
            latest_update: max(value.latest_update, latest_on_heap),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use constants::DURATION_TO_MAINTAIN_SUMMARY_UPDATES_DATA;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use rand::{Rng, RngExt, rng};

    type Model = BTreeMap<(Option<MessageIndex>, EventIndex), TimestampMillis>;

    #[test]
    fn recently_updated_events_are_returned_most_recent_first() {
        init_stable_memory_map();
        let chat1 = Chat::Direct(Principal::from_slice(&[1]).into());
        let chat2 = Chat::Direct(Principal::from_slice(&[2]).into());
        let mut timestamps1 = LastUpdatedTimestamps::default();
        let mut timestamps2 = LastUpdatedTimestamps::default();
        let mut model = Model::new();

        assert!(timestamps1.recently_updated_events(chat1, 0, usize::MAX).is_empty());

        for now in 1000..1500 {
            // Update a mixture of new and previously updated events, some of which are in threads
            let thread_root_message_index = rng().random_bool(0.3).then(|| MessageIndex::from(rng().next_u32() % 5));
            let event_index = EventIndex::from(rng().next_u32() % 200);
            timestamps1.mark_updated(chat1, thread_root_message_index, event_index, now);
            timestamps2.mark_updated(chat2, thread_root_message_index, event_index, now + 1000);
            model.insert((thread_root_message_index, event_index), now);
        }

        assert_eq!(timestamps1.latest_update(), Some(1499));
        for (since, max_count) in [(0, usize::MAX), (0, 10), (1200, usize::MAX), (1200, 50), (1499, usize::MAX)] {
            assert_eq!(
                timestamps1.recently_updated_events(chat1, since, max_count),
                expected_recently_updated_events(&model, since, max_count)
            );
        }
        for ((thread_root_message_index, event_index), ts) in model.iter() {
            assert_eq!(
                timestamps1.last_updated(chat1, *thread_root_message_index, *event_index),
                Some(*ts)
            );
        }
        assert_eq!(timestamps1.last_updated(chat1, None, 1000.into()), None);

        // The other chat's entries are unaffected
        assert!(
            timestamps2
                .recently_updated_events(chat2, 0, usize::MAX)
                .iter()
                .all(|(_, _, ts)| *ts >= 2000)
        );
        assert_eq!(timestamps2.recently_updated_events(chat2, 0, usize::MAX).len(), model.len());
    }

    #[test]
    fn heap_entries_are_migrated_to_stable_memory() {
        init_stable_memory_map();
        let chat = Chat::Group(Principal::from_slice(&[1]).into());
        let mut model = Model::new();

        // Recreate the state of a chat from before the timestamps were stored in stable memory
        let mut by_timestamp = BTreeSet::new();
        for i in 0..100u32 {
            let thread_root_message_index = (i % 3 == 0).then(|| MessageIndex::from(i % 7));
            by_timestamp.insert((1000 + i as u64, thread_root_message_index, EventIndex::from(i)));
            model.insert((thread_root_message_index, i.into()), 1000 + i as u64);
        }
        let mut timestamps = LastUpdatedTimestamps::from(LastUpdatedTimestampsTrimmed {
            by_timestamp,
            latest_update_removed: 0,
            latest_update: None,
        });
        assert_eq!(timestamps.latest_update(), Some(1099));

        // Plus some updates since then, including to events whose timestamps are on the heap
        for i in 90..110u32 {
            let thread_root_message_index = (i % 3 == 0).then(|| MessageIndex::from(i % 7));
            timestamps.mark_updated(chat, thread_root_message_index, i.into(), 2000 + i as u64);
            model.insert((thread_root_message_index, i.into()), 2000 + i as u64);
        }
        assert_eq!(timestamps.on_heap_count(), 90);
        assert_eq!(timestamps.latest_update(), Some(2109));
        assert_recently_updated_events_match(&timestamps, chat, &model);

        let bytes = msgpack::serialize_then_unwrap(&timestamps);
        // Must keep the field name used by the previous version so that upgrades and rollbacks both work
        assert!(bytes.windows(12).any(|w| w == b"by_timestamp"));
        let mut timestamps: LastUpdatedTimestamps = msgpack::deserialize_then_unwrap(&bytes);
        assert_eq!(timestamps.on_heap_count(), 90);
        assert_eq!(timestamps.latest_update(), Some(2109));
        assert_recently_updated_events_match(&timestamps, chat, &model);

        assert_eq!(timestamps.migrate_to_stable_memory(chat, 30), 30);
        assert_eq!(timestamps.on_heap_count(), 60);
        assert_recently_updated_events_match(&timestamps, chat, &model);
        assert_eq!(timestamps.migrate_to_stable_memory(chat, 1000), 60);
        assert_eq!(timestamps.on_heap_count(), 0);
        assert_eq!(timestamps.migrate_to_stable_memory(chat, 1000), 0);
        assert_recently_updated_events_match(&timestamps, chat, &model);

        for ((thread_root_message_index, event_index), ts) in model.iter() {
            assert_eq!(
                timestamps.last_updated(chat, *thread_root_message_index, *event_index),
                Some(*ts)
            );
        }
    }

    #[test]
    fn old_entries_are_pruned() {
        init_stable_memory_map();
        let chat = Chat::Channel(Principal::from_slice(&[1]).into(), 1u32.into());
        let mut timestamps = LastUpdatedTimestamps::from(LastUpdatedTimestampsTrimmed {
            by_timestamp: (0..10u32).map(|i| (i as u64, None, EventIndex::from(i))).collect(),
            latest_update_removed: 0,
            latest_update: None,
        });
        for i in 10..250u32 {
            timestamps.mark_updated(chat, None, i.into(), i as u64);
        }
        assert_eq!(timestamps.latest_update_removed(), 0);

        // Entries updated before 300 are now too old to keep. Only a limited number are removed
        // from stable memory each time an event is updated.
        let now = DURATION_TO_MAINTAIN_SUMMARY_UPDATES_DATA + 300;
        timestamps.mark_updated(chat, None, 1000.into(), now);
        assert_eq!(timestamps.on_heap_count(), 0);
        assert_eq!(timestamps.latest_update_removed(), 109);
        assert_eq!(timestamps.recently_updated_events(chat, 0, usize::MAX).len(), 141);
        assert_eq!(timestamps.last_updated(chat, None, 109.into()), None);
        assert_eq!(timestamps.last_updated(chat, None, 110.into()), Some(110));

        timestamps.mark_updated(chat, None, 1001.into(), now);
        assert_eq!(timestamps.latest_update_removed(), 209);
        timestamps.mark_updated(chat, None, 1002.into(), now);
        assert_eq!(timestamps.latest_update_removed(), 249);

        assert_eq!(
            timestamps.recently_updated_events(chat, 0, usize::MAX),
            vec![(None, 1002.into(), now), (None, 1001.into(), now), (None, 1000.into(), now)]
        );
        assert_eq!(timestamps.latest_update(), Some(now));
    }

    fn assert_recently_updated_events_match(timestamps: &LastUpdatedTimestamps, chat: Chat, model: &Model) {
        for (since, max_count) in [(0, usize::MAX), (0, 25), (1050, usize::MAX), (1050, 60), (2100, usize::MAX)] {
            assert_eq!(
                timestamps.recently_updated_events(chat, since, max_count),
                expected_recently_updated_events(model, since, max_count),
                "since: {since}, max_count: {max_count}"
            );
        }
    }

    fn expected_recently_updated_events(
        model: &Model,
        since: TimestampMillis,
        max_count: usize,
    ) -> Vec<(Option<MessageIndex>, EventIndex, TimestampMillis)> {
        let mut expected: Vec<_> = model
            .iter()
            .filter(|(_, ts)| **ts > since)
            .map(|((r, e), ts)| (*r, *e, *ts))
            .collect();
        expected.sort_unstable_by_key(|(r, e, ts)| Reverse((*ts, *r, *e)));
        expected.truncate(max_count);
        expected
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
