use serde::{Deserialize, Serialize};
use stable_memory_map::{ChitEventKey, ChitEventKeyPrefix, KeyPrefix, with_map, with_map_mut};
use std::ops::RangeInclusive;
use types::{ChitEvent, ChitEventType, TimestampMillis};
use utils::time::MonthKey;

// The events which changed the user's CHIT balance, ordered by timestamp. They are stored in the
// stable memory map for small entries, with the running totals kept on the heap.
#[derive(Serialize, Deserialize, Default)]
pub struct ChitEvents {
    // The events which were held on the heap, which are all moved into stable memory in
    // `post_upgrade` by `migrate_to_stable_memory`, so this is always empty otherwise.
    // TODO: Remove this after next release
    #[serde(rename = "events", default, skip_serializing)]
    on_heap: Vec<ChitEvent>,
    #[serde(default)]
    in_stable_memory_count: u32,
    // The sequence number for the next event written to stable memory, which distinguishes the
    // keys of events with the same timestamp
    #[serde(default)]
    next_sequence: u32,
    #[serde(default)]
    latest_timestamp_in_stable_memory: TimestampMillis,
    total_chit_earned: i32,
    #[serde(default)]
    total_chit_spent: i32,
}

impl ChitEvents {
    pub fn push(&mut self, event: ChitEvent) {
        if event.amount >= 0 {
            self.total_chit_earned += event.amount;
        } else {
            self.total_chit_spent += event.amount.abs();
        }

        let key = ChitEventKeyPrefix::new().create_key(&(event.timestamp, self.next_sequence));
        self.next_sequence += 1;
        with_map_mut(|m| m.insert(key, event_to_bytes(&event)));
        self.in_stable_memory_count += 1;
        self.latest_timestamp_in_stable_memory = self.latest_timestamp_in_stable_memory.max(event.timestamp);
    }

    // Returns a page of the events with timestamps within the given bounds (inclusive), along with
    // the total number of events within the bounds
    pub fn events(
        &self,
        from: Option<TimestampMillis>,
        to: Option<TimestampMillis>,
        skip: usize,
        max: usize,
        ascending: bool,
    ) -> (Vec<ChitEvent>, u32) {
        let (start, end) = if ascending { (from, to) } else { (to, from) };
        let (start, end) = (start.unwrap_or_default(), end.unwrap_or(TimestampMillis::MAX));

        if start > end {
            return (Vec::new(), 0);
        }

        // Only deserialize the events in the requested page
        with_map(|m| {
            let total = m.range(keys_between(start, end)).count() as u32;
            let page = m.range(keys_between(start, end));
            let events = if ascending {
                page.skip(skip)
                    .take(max)
                    .map(|(k, v)| event_from_bytes(k.timestamp(), &v))
                    .collect()
            } else {
                page.rev()
                    .skip(skip)
                    .take(max)
                    .map(|(k, v)| event_from_bytes(k.timestamp(), &v))
                    .collect()
            };
            (events, total)
        })
    }

    pub fn total_chit_earned(&self) -> i32 {
        self.total_chit_earned
    }

    pub fn chit_balance(&self) -> i32 {
        self.total_chit_earned - self.total_chit_spent
    }

    pub fn balance_for_month_by_timestamp(&self, ts: TimestampMillis) -> i32 {
        self.balance_for_month(MonthKey::from_timestamp(ts))
    }

    pub fn balance_for_month(&self, month: MonthKey) -> i32 {
        let timestamp_range = month.timestamp_range();
        self.events_between(timestamp_range.start, timestamp_range.end.saturating_sub(1))
            .iter()
            .map(|e| e.amount)
            .sum()
    }

    // Returns the achievements awarded after `since`, newest first
    pub fn achievements(&self, since: Option<TimestampMillis>) -> Vec<ChitEvent> {
        let mut achievements: Vec<_> = self
            .events_between(since.map_or(0, |ts| ts.saturating_add(1)), TimestampMillis::MAX)
            .into_iter()
            .filter(|e| {
                matches!(
                    e.reason,
                    ChitEventType::Achievement(_) | ChitEventType::ExternalAchievement(_)
                )
            })
            .collect();
        achievements.reverse();
        achievements
    }

    // Returns the timestamps of the daily claims, in order
    pub fn daily_claims(&self) -> Vec<TimestampMillis> {
        self.events_between(0, TimestampMillis::MAX)
            .iter()
            .filter(|e| {
                matches!(
                    e.reason,
                    ChitEventType::DailyClaim | ChitEventType::DailyClaimReinstated | ChitEventType::StreakInsuranceClaim
                )
            })
            .map(|e| e.timestamp)
            .collect()
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.latest_timestamp_in_stable_memory
    }

    pub fn len(&self) -> u32 {
        self.in_stable_memory_count
    }

    // Moves the events which were held on the heap into stable memory, returning how many were
    // moved
    // TODO: Remove this after next release
    pub fn migrate_to_stable_memory(&mut self) -> usize {
        if self.on_heap.is_empty() {
            return 0;
        }

        let prefix = ChitEventKeyPrefix::new();
        let mut latest = self.latest_timestamp_in_stable_memory;
        let mut next_sequence = self.next_sequence;

        // The events on the heap are ordered by timestamp, so their keys are in key order
        let entries: Vec<_> = std::mem::take(&mut self.on_heap)
            .into_iter()
            .map(|event| {
                latest = latest.max(event.timestamp);
                let key = prefix.create_key(&(event.timestamp, next_sequence));
                next_sequence += 1;
                (key, event_to_bytes(&event))
            })
            .collect();

        let count = entries.len();
        with_map_mut(|m| m.insert_many(entries));
        self.in_stable_memory_count += count as u32;
        self.next_sequence = next_sequence;
        self.latest_timestamp_in_stable_memory = latest;
        count
    }

    // Returns the events with timestamps within the given bounds (inclusive), in timestamp order
    fn events_between(&self, start: TimestampMillis, end: TimestampMillis) -> Vec<ChitEvent> {
        if start > end {
            return Vec::new();
        }

        with_map(|m| {
            m.range(keys_between(start, end))
                .map(|(k, v)| event_from_bytes(k.timestamp(), &v))
                .collect()
        })
    }
}

fn keys_between(start: TimestampMillis, end: TimestampMillis) -> RangeInclusive<ChitEventKey> {
    let prefix = ChitEventKeyPrefix::new();
    prefix.create_key(&(start, 0))..=prefix.create_key(&(end, u32::MAX))
}

fn event_to_bytes(event: &ChitEvent) -> Vec<u8> {
    msgpack::serialize_then_unwrap(ChitEventValue {
        amount: event.amount,
        reason: &event.reason,
    })
}

fn event_from_bytes(timestamp: TimestampMillis, bytes: &[u8]) -> ChitEvent {
    let value: ChitEventValueOwned = msgpack::deserialize_then_unwrap(bytes);
    ChitEvent {
        amount: value.amount,
        timestamp,
        reason: value.reason,
    }
}

// The form in which events are stored in stable memory. The timestamp is held in the key.
#[derive(Serialize)]
struct ChitEventValue<'a> {
    #[serde(rename = "a")]
    amount: i32,
    #[serde(rename = "r")]
    reason: &'a ChitEventType,
}

#[derive(Deserialize)]
struct ChitEventValueOwned {
    #[serde(rename = "a")]
    amount: i32,
    #[serde(rename = "r")]
    reason: ChitEventType,
}

#[cfg(test)]
mod tests {
    use super::*;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use types::Achievement;

    #[test]
    fn first_page_matches_expected() {
        let store = init_test_data(false);

        let (events, total) = store.events(None, None, 0, 3, true);

        assert_eq!(total, 7);
        assert_eq!(events.len(), 3);
        assert_eq!(events[0].timestamp, 10);
        assert_eq!(events[2].timestamp, 12);
    }

    #[test]
    fn next_page_matches_expected() {
        let store = init_test_data(false);

        let (events, _) = store.events(None, None, 3, 3, true);

        assert_eq!(events.len(), 3);
        assert_eq!(events[0].timestamp, 13);
        assert_eq!(events[2].timestamp, 15);
    }

    #[test]
    fn first_page_desc_matches_expected() {
        let store = init_test_data(false);

        let (events, _) = store.events(None, None, 0, 3, false);

        assert_eq!(events.len(), 3);
        assert_eq!(events[0].timestamp, 16);
        assert_eq!(events[2].timestamp, 14);
    }

    #[test]
    fn next_page_desc_matches_expected() {
        let store = init_test_data(false);

        let (events, _) = store.events(None, None, 3, 3, false);

        assert_eq!(events.len(), 3);
        assert_eq!(events[0].timestamp, 13);
        assert_eq!(events[2].timestamp, 11);
    }

    #[test]
    fn range_matches_expected() {
        let store = init_test_data(false);

        let (events, total) = store.events(Some(12), Some(15), 0, 99, true);

        assert_eq!(total, 4);
        assert_eq!(events.len(), 4);
        assert_eq!(events[0].timestamp, 12);
        assert_eq!(events[3].timestamp, 15);
    }

    #[test]
    fn range_desc_matches_expected() {
        let store = init_test_data(false);

        let (events, _) = store.events(Some(14), Some(11), 0, 99, false);

        assert_eq!(events.len(), 4);
        assert_eq!(events[0].timestamp, 14);
        assert_eq!(events[3].timestamp, 11);
    }

    #[test]
    fn events_with_the_same_timestamp_are_all_kept() {
        init_stable_memory_map();
        let mut store = ChitEvents::default();
        for _ in 0..5 {
            store.push(ChitEvent {
                amount: 100,
                timestamp: 10,
                reason: ChitEventType::DailyClaim,
            });
        }

        assert_eq!(store.len(), 5);
        assert_eq!(store.events(Some(10), Some(10), 0, 10, true).1, 5);
        assert_eq!(store.chit_balance(), 500);
        assert_eq!(store.daily_claims(), vec![10; 5]);
    }

    #[test]
    fn totals_and_achievements_match_expected() {
        let store = init_test_data(false);

        assert_eq!(store.total_chit_earned(), 2500);
        assert_eq!(store.chit_balance(), 2500);
        assert_eq!(store.last_updated(), 16);
        assert_eq!(store.daily_claims(), vec![10, 11, 12, 14]);

        let achievements = store.achievements(None);
        assert_eq!(achievements.len(), 3);
        assert_eq!(achievements[0].timestamp, 16);
        assert_eq!(achievements[2].timestamp, 13);

        let achievements = store.achievements(Some(13));
        assert_eq!(achievements.len(), 2);
        assert_eq!(achievements[0].timestamp, 16);
        assert_eq!(achievements[1].timestamp, 15);
    }

    #[test]
    fn spent_chit_reduces_balance() {
        let mut store = init_test_data(false);
        store.push(ChitEvent {
            amount: -700,
            timestamp: 20,
            reason: ChitEventType::PurchasedPremiumItem(1),
        });

        assert_eq!(store.total_chit_earned(), 2500);
        assert_eq!(store.chit_balance(), 1800);
        assert_eq!(store.last_updated(), 20);
        assert_eq!(store.len(), 8);
    }

    #[test]
    fn events_on_heap_are_migrated_to_stable_memory() {
        let expected = init_test_data(false);
        let pages = |store: &ChitEvents| {
            [true, false].map(|ascending| {
                (0..4)
                    .map(|page| {
                        let (events, total) = store.events(None, None, page * 3, 3, ascending);
                        (events.iter().map(|e| (e.timestamp, e.amount)).collect::<Vec<_>>(), total)
                    })
                    .collect::<Vec<_>>()
            })
        };
        let expected_pages = pages(&expected);

        let mut store = init_test_data(true);
        assert_eq!(store.migrate_to_stable_memory(), 7);
        assert!(store.on_heap.is_empty());
        assert_eq!(store.migrate_to_stable_memory(), 0);

        assert_eq!(pages(&store), expected_pages);
        assert_eq!(store.len(), 7);
        assert_eq!(store.last_updated(), 16);
        assert_eq!(store.chit_balance(), 2500);
        assert_eq!(store.achievements(Some(13)).len(), 2);
        assert_eq!(store.daily_claims(), vec![10, 11, 12, 14]);

        // New events are keyed after the migrated ones, so none are overwritten
        store.push(ChitEvent {
            amount: 200,
            timestamp: 16,
            reason: ChitEventType::DailyClaim,
        });
        assert_eq!(store.len(), 8);
        assert_eq!(store.events(Some(16), Some(16), 0, 10, true).1, 2);

        // The heap isn't serialized
        let deserialized: ChitEvents = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&store));
        assert_eq!(deserialized.len(), 8);
    }

    fn init_test_data(on_heap: bool) -> ChitEvents {
        init_stable_memory_map();
        let events = vec![
            ChitEvent {
                amount: 200,
                timestamp: 10,
                reason: ChitEventType::DailyClaim,
            },
            ChitEvent {
                amount: 200,
                timestamp: 11,
                reason: ChitEventType::DailyClaim,
            },
            ChitEvent {
                amount: 300,
                timestamp: 12,
                reason: ChitEventType::DailyClaim,
            },
            ChitEvent {
                amount: 500,
                timestamp: 13,
                reason: ChitEventType::Achievement(Achievement::SetBio),
            },
            ChitEvent {
                amount: 300,
                timestamp: 14,
                reason: ChitEventType::DailyClaim,
            },
            ChitEvent {
                amount: 500,
                timestamp: 15,
                reason: ChitEventType::Achievement(Achievement::SetAvatar),
            },
            ChitEvent {
                amount: 500,
                timestamp: 16,
                reason: ChitEventType::Achievement(Achievement::SentDirectMessage),
            },
        ];

        if on_heap {
            let total_chit_earned = events.iter().map(|e| e.amount).sum();
            ChitEvents {
                on_heap: events,
                total_chit_earned,
                ..Default::default()
            }
        } else {
            let mut store = ChitEvents::default();
            for event in events {
                store.push(event);
            }
            store
        }
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
