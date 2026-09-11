use serde::{Deserialize, Serialize};
use stable_memory_map::{ExpiringEventKeyPrefix, KeyPrefix, with_map, with_map_mut};
use std::collections::BTreeSet;
use types::{Chat, EventIndex, MAX_EVENT_INDEX, MIN_EVENT_INDEX, TimestampMillis};

// The events which are due to expire, ordered by their expiry dates. The entries are stored in the
// stable memory map for small entries.
#[derive(Serialize, Deserialize, Default)]
pub struct ExpiringEvents {
    // Entries which haven't yet been moved into stable memory. New entries are always written to
    // stable memory, and existing ones are moved across in batches by `migrate_to_stable_memory`.
    // This can be removed once every chat has been migrated. It is always serialized so that a
    // canister can still be rolled back to a version expecting it.
    #[serde(rename = "event_expiry_dates", default)]
    on_heap: BTreeSet<(TimestampMillis, EventIndex)>,
    // A lower bound for the expiry dates of the entries in stable memory, or `None` if there are
    // none, so that checking when the next event expires doesn't require reading from stable
    // memory. This is exact other than while expired events are being taken.
    #[serde(rename = "n", default, skip_serializing_if = "Option::is_none")]
    next_expiry_in_stable_memory: Option<TimestampMillis>,
}

impl ExpiringEvents {
    pub fn insert(&mut self, chat: Chat, event_index: EventIndex, expires_at: TimestampMillis) {
        let key = ExpiringEventKeyPrefix::new_from_chat(chat).create_key(&(expires_at, event_index));
        with_map_mut(|m| m.insert(key, Vec::new()));

        if self.next_expiry_in_stable_memory.is_none_or(|ts| expires_at < ts) {
            self.next_expiry_in_stable_memory = Some(expires_at);
        }
    }

    pub fn next_event_expiry(&self) -> Option<TimestampMillis> {
        let next_on_heap = self.on_heap.first().map(|(ts, _)| *ts);
        [next_on_heap, self.next_expiry_in_stable_memory].into_iter().flatten().min()
    }

    pub fn take_next_expired_event(&mut self, chat: Chat, now: TimestampMillis) -> Option<EventIndex> {
        if self.on_heap.first().is_some_and(|(ts, _)| *ts <= now) {
            return self.on_heap.pop_first().map(|(_, i)| i);
        }

        if self.next_expiry_in_stable_memory.is_none_or(|ts| ts > now) {
            return None;
        }

        let prefix = ExpiringEventKeyPrefix::new_from_chat(chat);
        match first_entry_in_stable_memory(&prefix) {
            Some((expires_at, event_index)) if expires_at <= now => {
                with_map_mut(|m| m.remove(prefix.create_key(&(expires_at, event_index))));
                // The removed entry's expiry date is still a lower bound for the remaining entries,
                // and the exact value is set once there are no more expired entries to take
                self.next_expiry_in_stable_memory = Some(expires_at);
                Some(event_index)
            }
            next => {
                self.next_expiry_in_stable_memory = next.map(|(ts, _)| ts);
                None
            }
        }
    }

    // Recalculates the next expiry date of the entries in stable memory, which is needed after
    // entries have been written directly to stable memory (eg. when importing a group into a
    // community)
    pub fn refresh_next_expiry(&mut self, chat: Chat) {
        let prefix = ExpiringEventKeyPrefix::new_from_chat(chat);
        self.next_expiry_in_stable_memory = first_entry_in_stable_memory(&prefix).map(|(ts, _)| ts);
    }

    // Moves up to `max_count` entries from the heap into stable memory, returning how many were
    // moved
    pub fn migrate_to_stable_memory(&mut self, chat: Chat, max_count: usize) -> usize {
        let mut count = 0;
        while count < max_count
            && let Some((expires_at, event_index)) = self.on_heap.pop_first()
        {
            self.insert(chat, event_index, expires_at);
            count += 1;
        }
        count
    }

    pub fn on_heap_count(&self) -> usize {
        self.on_heap.len()
    }

    pub fn discard_on_heap(&mut self) {
        self.on_heap = BTreeSet::new();
    }
}

fn first_entry_in_stable_memory(prefix: &ExpiringEventKeyPrefix) -> Option<(TimestampMillis, EventIndex)> {
    let start = prefix.create_key(&(TimestampMillis::MIN, MIN_EVENT_INDEX));
    let end = prefix.create_key(&(TimestampMillis::MAX, MAX_EVENT_INDEX));
    with_map(|m| m.range(start..=end).next().map(|(k, _)| (k.expires_at(), k.event_index())))
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use rand::{Rng, rng};

    #[test]
    fn expired_events_are_taken_in_expiry_order() {
        init_stable_memory_map();
        let chat1 = Chat::Direct(Principal::from_slice(&[1]).into());
        let chat2 = Chat::Direct(Principal::from_slice(&[2]).into());
        let mut expiring_events1 = ExpiringEvents::default();
        let mut expiring_events2 = ExpiringEvents::default();

        let mut expected1 = BTreeSet::new();
        for i in 0..100u32 {
            let expires_at = 1000 + (rng().next_u64() % 1000);
            expiring_events1.insert(chat1, i.into(), expires_at);
            expiring_events2.insert(chat2, i.into(), expires_at + 5000);
            expected1.insert((expires_at, EventIndex::from(i)));
        }

        assert_eq!(expiring_events1.next_event_expiry(), expected1.first().map(|(ts, _)| *ts));
        assert_eq!(expiring_events1.take_next_expired_event(chat1, 999), None);

        for now in [1250, 1500, 2000] {
            let mut taken = Vec::new();
            while let Some(event_index) = expiring_events1.take_next_expired_event(chat1, now) {
                taken.push(event_index);
            }
            let expected_taken: Vec<_> = expected1.iter().take_while(|(ts, _)| *ts <= now).map(|(_, i)| *i).collect();
            expected1.retain(|(ts, _)| *ts > now);

            assert_eq!(taken, expected_taken);
            assert_eq!(expiring_events1.next_event_expiry(), expected1.first().map(|(ts, _)| *ts));
        }
        assert!(expected1.is_empty());
        assert_eq!(expiring_events1.next_event_expiry(), None);

        // The other chat's entries are unaffected
        assert!(expiring_events2.next_event_expiry().is_some_and(|ts| ts > 5000));
        assert_eq!(expiring_events2.take_next_expired_event(chat2, 5999), None);
        let mut taken_count = 0;
        while expiring_events2.take_next_expired_event(chat2, 10000).is_some() {
            taken_count += 1;
        }
        assert_eq!(taken_count, 100);
    }

    #[test]
    fn heap_entries_are_migrated_to_stable_memory() {
        init_stable_memory_map();
        let chat = Chat::Group(Principal::from_slice(&[1]).into());
        let mut expiring_events = ExpiringEvents::default();

        // Recreate the state of a chat from before expiring events were stored in stable memory
        for i in 0..100u32 {
            expiring_events.on_heap.insert((1000 + i as u64, i.into()));
        }
        // Plus some entries added since then
        for i in 100..110u32 {
            expiring_events.insert(chat, i.into(), 2000 + i as u64);
        }
        assert_eq!(expiring_events.on_heap_count(), 100);
        assert_eq!(expiring_events.next_event_expiry(), Some(1000));

        let bytes = msgpack::serialize_then_unwrap(&expiring_events);
        // Must keep the field name used by the previous version so that upgrades and rollbacks both work
        assert!(bytes.windows(18).any(|w| w == b"event_expiry_dates"));
        let mut expiring_events: ExpiringEvents = msgpack::deserialize_then_unwrap(&bytes);
        assert_eq!(expiring_events.on_heap_count(), 100);
        assert_eq!(expiring_events.next_event_expiry(), Some(1000));

        assert_eq!(expiring_events.migrate_to_stable_memory(chat, 30), 30);
        assert_eq!(expiring_events.on_heap_count(), 70);
        assert_eq!(expiring_events.migrate_to_stable_memory(chat, 1000), 70);
        assert_eq!(expiring_events.on_heap_count(), 0);
        assert_eq!(expiring_events.migrate_to_stable_memory(chat, 1000), 0);
        assert_eq!(expiring_events.next_event_expiry(), Some(1000));

        let mut taken = Vec::new();
        while let Some(event_index) = expiring_events.take_next_expired_event(chat, 3000) {
            taken.push(u32::from(event_index));
        }
        assert_eq!(taken, (0..110).collect::<Vec<_>>());
        assert_eq!(expiring_events.next_event_expiry(), None);
    }

    #[test]
    fn heap_and_stable_memory_entries_are_both_taken() {
        init_stable_memory_map();
        let chat = Chat::Group(Principal::from_slice(&[1]).into());
        let mut expiring_events = ExpiringEvents::default();

        expiring_events.on_heap.insert((1000, 1.into()));
        expiring_events.on_heap.insert((3000, 3.into()));
        expiring_events.insert(chat, 2.into(), 2000);
        expiring_events.insert(chat, 4.into(), 4000);

        let mut next_expiry_dates = Vec::new();
        let mut taken = Vec::new();
        for now in [1000, 2000, 3000, 4000] {
            next_expiry_dates.push(expiring_events.next_event_expiry().unwrap());
            while let Some(event_index) = expiring_events.take_next_expired_event(chat, now) {
                taken.push(u32::from(event_index));
            }
        }
        assert_eq!(next_expiry_dates, vec![1000, 2000, 3000, 4000]);
        assert_eq!(taken, vec![1, 2, 3, 4]);
        assert_eq!(expiring_events.next_event_expiry(), None);
    }

    #[test]
    fn refresh_next_expiry_reads_from_stable_memory() {
        init_stable_memory_map();
        let chat = Chat::Group(Principal::from_slice(&[1]).into());
        let mut expiring_events = ExpiringEvents::default();

        let prefix = ExpiringEventKeyPrefix::new_from_chat(chat);
        with_map_mut(|m| {
            m.insert(prefix.create_key(&(2000, 2.into())), Vec::new());
            m.insert(prefix.create_key(&(1000, 1.into())), Vec::new());
        });
        assert_eq!(expiring_events.next_event_expiry(), None);

        expiring_events.refresh_next_expiry(chat);
        assert_eq!(expiring_events.next_event_expiry(), Some(1000));
    }

    #[test]
    fn discarding_heap_entries_keeps_stable_memory_entries() {
        init_stable_memory_map();
        let chat = Chat::Group(Principal::from_slice(&[1]).into());
        let mut expiring_events = ExpiringEvents::default();

        // Recreate an imported group whose heap entries are duplicates of those written to stable
        // memory during the import
        for i in 0..10u32 {
            expiring_events.on_heap.insert((1000 + i as u64, i.into()));
            expiring_events.insert(chat, i.into(), 1000 + i as u64);
        }
        expiring_events.discard_on_heap();
        assert_eq!(expiring_events.on_heap_count(), 0);
        assert_eq!(expiring_events.next_event_expiry(), Some(1000));

        let mut taken = Vec::new();
        while let Some(event_index) = expiring_events.take_next_expired_event(chat, u64::MAX) {
            taken.push(u32::from(event_index));
        }
        assert_eq!(taken, (0..10).collect::<Vec<_>>());
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
