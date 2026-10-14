use constants::calculate_summary_updates_data_removal_cutoff;
use serde::{Deserialize, Serialize};
use stable_memory_map::{
    ChatEventKeyPrefix, EventLastUpdatedKeyPrefix, EventsByLastUpdatedKeyPrefix, KeyPrefix, with_map, with_map_mut,
};
use std::cmp::max;
use types::{EventIndex, MAX_EVENT_INDEX, MIN_EVENT_INDEX, MessageIndex, TimestampMillis};

// The maximum number of expired entries to remove from stable memory each time an event is marked
// as updated, so that the cost of marking an event as updated stays bounded
const MAX_STABLE_MEMORY_ENTRIES_TO_PRUNE: usize = 100;

// When each event (including events in threads) was last updated. The entries are stored in the
// stable memory map for small entries, both keyed by event and ordered by timestamp.
#[derive(Serialize, Deserialize, Default)]
pub struct LastUpdatedTimestamps {
    #[serde(default)]
    latest_update_removed: TimestampMillis,
    // The most recent time that any event was marked as updated, which is always at least as
    // recent as every entry, so that it can be read without reading from stable memory
    #[serde(rename = "l", default, skip_serializing_if = "Option::is_none")]
    latest_update: Option<TimestampMillis>,
}

impl LastUpdatedTimestamps {
    pub fn mark_updated(
        &mut self,
        events_prefix: &ChatEventKeyPrefix,
        thread_root_message_index: Option<MessageIndex>,
        event_index: EventIndex,
        now: TimestampMillis,
    ) {
        self.prune(events_prefix, now);
        insert_into_stable_memory(events_prefix, thread_root_message_index, event_index, now);
        self.latest_update = max(self.latest_update, Some(now));
    }

    // The events which were last updated after `since`, most recently updated first
    pub fn recently_updated_events(
        &self,
        events_prefix: &ChatEventKeyPrefix,
        since: TimestampMillis,
        max_count: usize,
    ) -> Vec<(Option<MessageIndex>, EventIndex, TimestampMillis)> {
        let Some(from) = since.checked_add(1) else {
            return Vec::new();
        };
        if self.latest_update.is_none_or(|ts| ts < from) {
            return Vec::new();
        }

        let prefix = EventsByLastUpdatedKeyPrefix::new_from_events_prefix(events_prefix);
        let start = prefix.create_key(&(from, None, MIN_EVENT_INDEX));
        let end = prefix.create_key(&(TimestampMillis::MAX, Some(u32::MAX.into()), MAX_EVENT_INDEX));
        with_map(|m| {
            m.range(start..=end)
                .rev()
                .take(max_count)
                .map(|(k, _)| (k.thread_root_message_index(), k.event_index(), k.last_updated()))
                .collect()
        })
    }

    pub fn last_updated(
        &self,
        events_prefix: &ChatEventKeyPrefix,
        thread_root_message_index: Option<MessageIndex>,
        event_index: EventIndex,
    ) -> Option<TimestampMillis> {
        self.latest_update?;

        let key = EventLastUpdatedKeyPrefix::new_from_events_prefix(events_prefix)
            .create_key(&(thread_root_message_index, event_index));
        with_map(|m| m.get(key)).map(|bytes| bytes_to_timestamp(&bytes))
    }

    pub fn latest_update(&self) -> Option<TimestampMillis> {
        self.latest_update
    }

    pub fn latest_update_removed(&self) -> TimestampMillis {
        self.latest_update_removed
    }

    // Removes the entries which are too old to be included in summary updates. Only a limited
    // number of entries are removed from stable memory at a time, any remaining entries are
    // removed by subsequent calls.
    fn prune(&mut self, events_prefix: &ChatEventKeyPrefix, now: TimestampMillis) {
        let cutoff = calculate_summary_updates_data_removal_cutoff(now);

        let by_event_prefix = EventLastUpdatedKeyPrefix::new_from_events_prefix(events_prefix);
        let by_timestamp_prefix = EventsByLastUpdatedKeyPrefix::new_from_events_prefix(events_prefix);
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
    events_prefix: &ChatEventKeyPrefix,
    thread_root_message_index: Option<MessageIndex>,
    event_index: EventIndex,
    ts: TimestampMillis,
) {
    let by_event_key =
        EventLastUpdatedKeyPrefix::new_from_events_prefix(events_prefix).create_key(&(thread_root_message_index, event_index));
    let by_timestamp_prefix = EventsByLastUpdatedKeyPrefix::new_from_events_prefix(events_prefix);

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

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use constants::DURATION_TO_MAINTAIN_SUMMARY_UPDATES_DATA;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use rand::{Rng, RngExt, rng};
    use std::cmp::Reverse;
    use std::collections::BTreeMap;
    use types::Chat;

    type Model = BTreeMap<(Option<MessageIndex>, EventIndex), TimestampMillis>;

    #[test]
    fn recently_updated_events_are_returned_most_recent_first() {
        init_stable_memory_map();
        let chat1 = ChatEventKeyPrefix::new_from_direct_chat_key_id(1, None);
        let chat2 = ChatEventKeyPrefix::new_from_direct_chat_key_id(2, None);
        let mut timestamps1 = LastUpdatedTimestamps::default();
        let mut timestamps2 = LastUpdatedTimestamps::default();
        let mut model = Model::new();

        assert!(timestamps1.recently_updated_events(&chat1, 0, usize::MAX).is_empty());

        for now in 1000..1500 {
            // Update a mixture of new and previously updated events, some of which are in threads
            let thread_root_message_index = rng().random_bool(0.3).then(|| MessageIndex::from(rng().next_u32() % 5));
            let event_index = EventIndex::from(rng().next_u32() % 200);
            timestamps1.mark_updated(&chat1, thread_root_message_index, event_index, now);
            timestamps2.mark_updated(&chat2, thread_root_message_index, event_index, now + 1000);
            model.insert((thread_root_message_index, event_index), now);
        }

        assert_eq!(timestamps1.latest_update(), Some(1499));
        for (since, max_count) in [(0, usize::MAX), (0, 10), (1200, usize::MAX), (1200, 50), (1499, usize::MAX)] {
            assert_eq!(
                timestamps1.recently_updated_events(&chat1, since, max_count),
                expected_recently_updated_events(&model, since, max_count)
            );
        }
        for ((thread_root_message_index, event_index), ts) in model.iter() {
            assert_eq!(
                timestamps1.last_updated(&chat1, *thread_root_message_index, *event_index),
                Some(*ts)
            );
        }
        assert_eq!(timestamps1.last_updated(&chat1, None, 1000.into()), None);

        // The other chat's entries are unaffected
        assert!(
            timestamps2
                .recently_updated_events(&chat2, 0, usize::MAX)
                .iter()
                .all(|(_, _, ts)| *ts >= 2000)
        );
        assert_eq!(timestamps2.recently_updated_events(&chat2, 0, usize::MAX).len(), model.len());
    }

    #[test]
    fn old_entries_are_pruned() {
        init_stable_memory_map();
        let chat = ChatEventKeyPrefix::new_from_chat(Chat::Channel(Principal::from_slice(&[1]).into(), 1u32.into()), None);
        let mut timestamps = LastUpdatedTimestamps::default();
        for i in 0..250u32 {
            timestamps.mark_updated(&chat, None, i.into(), i as u64);
        }
        assert_eq!(timestamps.latest_update_removed(), 0);

        // Entries updated before 300 are now too old to keep. Only a limited number are removed
        // from stable memory each time an event is updated.
        let now = DURATION_TO_MAINTAIN_SUMMARY_UPDATES_DATA + 300;
        timestamps.mark_updated(&chat, None, 1000.into(), now);
        assert_eq!(timestamps.latest_update_removed(), 99);
        assert_eq!(timestamps.recently_updated_events(&chat, 0, usize::MAX).len(), 151);
        assert_eq!(timestamps.last_updated(&chat, None, 99.into()), None);
        assert_eq!(timestamps.last_updated(&chat, None, 100.into()), Some(100));

        timestamps.mark_updated(&chat, None, 1001.into(), now);
        assert_eq!(timestamps.latest_update_removed(), 199);
        timestamps.mark_updated(&chat, None, 1002.into(), now);
        assert_eq!(timestamps.latest_update_removed(), 249);

        assert_eq!(
            timestamps.recently_updated_events(&chat, 0, usize::MAX),
            vec![(None, 1002.into(), now), (None, 1001.into(), now), (None, 1000.into(), now)]
        );
        assert_eq!(timestamps.latest_update(), Some(now));
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
