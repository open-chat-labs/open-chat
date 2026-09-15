use candid::Principal;
use stable_memory_map::{KeyPrefix, RemovedChatKey, RemovedChatKeyPrefix, with_map, with_map_mut};
use std::collections::HashSet;
use std::ops::RangeInclusive;
use types::TimestampMillis;

// Records of the chats (direct chats, groups or communities) the user has been removed from,
// stored in the stable memory map for small entries keyed by (timestamp, chat id)

pub fn add(prefix: &RemovedChatKeyPrefix, chat_id: Principal, now: TimestampMillis) {
    with_map_mut(|m| m.insert(prefix.create_key(&(now, chat_id)), Vec::new()));
}

// Returns each chat removed after `since`, most recently removed first. A chat which was removed
// multiple times may be returned multiple times.
pub fn removed_since(prefix: &RemovedChatKeyPrefix, since: TimestampMillis) -> Vec<(TimestampMillis, Principal)> {
    let Some(range) = range(prefix, since) else {
        return Vec::new();
    };
    with_map(|m| m.range(range).rev().map(|(k, _)| (k.timestamp(), k.chat_id())).collect())
}

// Returns each chat removed after `since` which `is_current` returns false for, most recently
// removed first and with each chat only returned once
pub fn removed_since_excluding<T: Copy + From<Principal> + Eq + std::hash::Hash>(
    prefix: &RemovedChatKeyPrefix,
    since: TimestampMillis,
    is_current: impl Fn(&T) -> bool,
) -> Vec<T> {
    let Some(range) = range(prefix, since) else {
        return Vec::new();
    };
    let mut seen = HashSet::new();
    // The entries are filtered while iterating so that only the chats returned are collected
    with_map(|m| {
        m.range(range)
            .rev()
            .map(|(k, _)| T::from(k.chat_id()))
            .filter(|chat_id| !is_current(chat_id) && seen.insert(*chat_id))
            .collect()
    })
}

// Only reads the first matching entry
pub fn any_removed_since(prefix: &RemovedChatKeyPrefix, since: TimestampMillis) -> bool {
    range(prefix, since).is_some_and(|range| with_map(|m| m.range(range).next().is_some()))
}

// The range of keys of the chats removed after `since`, or None if there can't be any. The iterators
// over this range borrow the stable memory map, so they must be consumed within `with_map`.
fn range(prefix: &RemovedChatKeyPrefix, since: TimestampMillis) -> Option<RangeInclusive<RemovedChatKey>> {
    let start = since.checked_add(1)?;
    Some(
        prefix.create_key(&(start, Principal::from_slice(&[])))
            ..=prefix.create_key(&(TimestampMillis::MAX, Principal::from_slice(&[u8::MAX; 29]))),
    )
}

// Moves the records of removed chats which were held on the heap into stable memory, returning how
// many were moved
// TODO: Remove this after next release
pub fn migrate_to_stable_memory(
    prefix: &RemovedChatKeyPrefix,
    entries: impl IntoIterator<Item = (TimestampMillis, Principal)>,
) -> usize {
    let mut entries: Vec<_> = entries
        .into_iter()
        .map(|entry| (prefix.create_key(&entry), Vec::new()))
        .collect();
    if entries.is_empty() {
        return 0;
    }
    // Insert the entries in key order
    entries.sort_unstable_by(|(a, _), (b, _)| a.cmp(b));

    let count = entries.len();
    with_map_mut(|m| m.insert_many(entries));
    count
}

#[cfg(test)]
mod tests {
    use super::*;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use types::ChatId;

    #[test]
    fn removed_since_returns_the_most_recent_first() {
        init_stable_memory_map();
        let prefix = RemovedChatKeyPrefix::new_for_group_chats();

        add(&prefix, chat(1), 10);
        add(&prefix, chat(2), 20);
        add(&prefix, chat(1), 30);

        assert_eq!(removed_since(&prefix, 0), vec![(30, chat(1)), (20, chat(2)), (10, chat(1))]);
        assert_eq!(removed_since(&prefix, 20), vec![(30, chat(1))]);
        assert_eq!(removed_since(&prefix, 30).len(), 0);
        assert_eq!(removed_since(&prefix, TimestampMillis::MAX).len(), 0);
        assert!(any_removed_since(&prefix, 29));
        assert!(!any_removed_since(&prefix, 30));
        assert!(!any_removed_since(&prefix, TimestampMillis::MAX));
    }

    #[test]
    fn removed_since_excluding_skips_current_chats_and_duplicates() {
        init_stable_memory_map();
        let prefix = RemovedChatKeyPrefix::new_for_group_chats();

        add(&prefix, chat(1), 10);
        add(&prefix, chat(2), 20);
        add(&prefix, chat(3), 30);
        add(&prefix, chat(1), 40);

        let removed: Vec<ChatId> = removed_since_excluding(&prefix, 0, |c: &ChatId| *c == chat(2).into());
        assert_eq!(removed, vec![chat(1).into(), chat(3).into()]);
    }

    #[test]
    fn lists_are_kept_separate() {
        init_stable_memory_map();
        let direct_chats = RemovedChatKeyPrefix::new_for_direct_chats();
        let group_chats = RemovedChatKeyPrefix::new_for_group_chats();
        let communities = RemovedChatKeyPrefix::new_for_communities();

        add(&direct_chats, chat(1), 10);
        add(&group_chats, chat(2), 20);
        add(&communities, chat(3), 30);

        assert_eq!(removed_since(&direct_chats, 0), vec![(10, chat(1))]);
        assert_eq!(removed_since(&group_chats, 0), vec![(20, chat(2))]);
        assert_eq!(removed_since(&communities, 0), vec![(30, chat(3))]);
    }

    #[test]
    fn entries_are_migrated_to_stable_memory() {
        init_stable_memory_map();
        let prefix = RemovedChatKeyPrefix::new_for_communities();

        assert_eq!(migrate_to_stable_memory(&prefix, Vec::new()), 0);
        assert_eq!(
            migrate_to_stable_memory(&prefix, (1..=50u8).rev().map(|i| (i as u64, chat(i)))),
            50
        );

        assert_eq!(
            removed_since(&prefix, 0),
            (1..=50u8).rev().map(|i| (i as u64, chat(i))).collect::<Vec<_>>()
        );
    }

    fn chat(i: u8) -> Principal {
        Principal::from_slice(&[i; 10])
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
