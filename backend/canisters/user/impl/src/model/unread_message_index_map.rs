use serde::{Deserialize, Serialize};
use stable_memory_map::{
    BaseKeyPrefix, DirectChatUnreadMessageIndexKey, DirectChatUnreadMessageIndexKeyPrefix, KeyPrefix, with_map, with_map_mut,
};
use std::collections::BTreeMap;
use std::ops::RangeInclusive;
use types::{MessageIndex, UserId};

/// This is used to tell the other user which of their messages we have read.
/// Their message indexes will not necessarily match with ours, so when we mark a message as read
/// using our own message index, we then need to convert that into their message index and tell them
/// that it has been read. Because this map is only used to handle marking their messages as read,
/// it only stores data for messages sent by them, and we can remove entries once they have been
/// marked as read.
///
/// The entries are stored in the stable memory map for small entries, so the other user must be
/// passed in to identify them.
#[derive(Serialize, Deserialize, Default)]
pub struct UnreadMessageIndexMap {
    // The entries which were held on the heap, which are all moved into stable memory in
    // `post_upgrade` by `migrate_to_stable_memory`, so this is always empty otherwise.
    // TODO: Remove this after next release
    #[serde(rename = "map", default, skip_serializing)]
    on_heap: BTreeMap<MessageIndex, MessageIndex>,
}

impl UnreadMessageIndexMap {
    pub fn add(&mut self, them: UserId, ours: MessageIndex, theirs: MessageIndex) {
        let key = DirectChatUnreadMessageIndexKeyPrefix::new(them).create_key(&ours);
        with_map_mut(|m| m.insert(key, u32::from(theirs).to_be_bytes().to_vec()));
    }

    pub fn get_max_read_up_to_of_theirs(&self, them: UserId, ours_read_up_to: &MessageIndex) -> Option<MessageIndex> {
        let prefix = DirectChatUnreadMessageIndexKeyPrefix::new(them);
        with_map(|m| {
            m.range(prefix.create_key(&MessageIndex::from(0))..=prefix.create_key(ours_read_up_to))
                .map(|(_, v)| value_from_bytes(&v))
                .max()
        })
    }

    pub fn remove_up_to(&mut self, them: UserId, theirs: MessageIndex) {
        with_map_mut(|m| {
            // Their message indexes aren't necessarily in the same order as ours, so every entry
            // must be checked
            let keys: Vec<_> = m
                .range(all_keys(them))
                .filter(|(_, v)| value_from_bytes(v) <= theirs)
                .map(|(k, _)| k)
                .collect();
            for key in keys {
                m.remove(key);
            }
        });
    }

    pub fn stable_memory_key_prefix(them: UserId) -> BaseKeyPrefix {
        DirectChatUnreadMessageIndexKeyPrefix::new(them).into()
    }

    // Moves the entries which were held on the heap into stable memory, returning how many were
    // moved
    // TODO: Remove this after next release
    pub fn migrate_to_stable_memory(&mut self, them: UserId) -> usize {
        if self.on_heap.is_empty() {
            return 0;
        }

        let prefix = DirectChatUnreadMessageIndexKeyPrefix::new(them);
        // The entries are in our message index order, so they are inserted in key order
        let entries = std::mem::take(&mut self.on_heap);
        let count = entries.len();
        with_map_mut(|m| {
            m.insert_many(
                entries
                    .into_iter()
                    .map(|(ours, theirs)| (prefix.create_key(&ours), u32::from(theirs).to_be_bytes().to_vec())),
            )
        });
        count
    }
}

fn all_keys(them: UserId) -> RangeInclusive<DirectChatUnreadMessageIndexKey> {
    let prefix = DirectChatUnreadMessageIndexKeyPrefix::new(them);
    prefix.create_key(&MessageIndex::from(0))..=prefix.create_key(&MessageIndex::from(u32::MAX))
}

// Their message index    4 bytes
fn value_from_bytes(bytes: &[u8]) -> MessageIndex {
    u32::from_be_bytes(bytes[..4].try_into().unwrap()).into()
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};

    #[test]
    fn get_max_read_up_to_of_theirs() {
        init_stable_memory_map();
        let them = user_id(1);
        let mut map = UnreadMessageIndexMap::default();
        map.add(them, 1.into(), 5.into());
        map.add(them, 2.into(), 7.into());
        map.add(them, 3.into(), 6.into());
        map.add(them, 4.into(), 8.into());
        map.add(them, 5.into(), 9.into());

        assert_eq!(map.get_max_read_up_to_of_theirs(them, &0.into()), None);
        assert_eq!(map.get_max_read_up_to_of_theirs(them, &3.into()), Some(7.into()));
        assert_eq!(map.get_max_read_up_to_of_theirs(them, &5.into()), Some(9.into()));
    }

    #[test]
    fn remove_up_to() {
        init_stable_memory_map();
        let them = user_id(1);
        let mut map = UnreadMessageIndexMap::default();
        map.add(them, 1.into(), 5.into());
        map.add(them, 2.into(), 7.into());
        map.add(them, 3.into(), 6.into());
        map.add(them, 4.into(), 8.into());
        map.add(them, 5.into(), 9.into());

        map.remove_up_to(them, 0.into());
        assert_eq!(entries(them).len(), 5);

        map.remove_up_to(them, 7.into());
        assert_eq!(entries(them), vec![(4.into(), 8.into()), (5.into(), 9.into())]);

        map.remove_up_to(them, 9.into());
        assert!(entries(them).is_empty());
    }

    #[test]
    fn entries_are_stored_per_chat() {
        init_stable_memory_map();
        let (user1, user2) = (user_id(1), user_id(2));
        let mut map1 = UnreadMessageIndexMap::default();
        let mut map2 = UnreadMessageIndexMap::default();
        map1.add(user1, 1.into(), 10.into());
        map2.add(user2, 1.into(), 20.into());
        map2.add(user2, 2.into(), 21.into());

        assert_eq!(map1.get_max_read_up_to_of_theirs(user1, &5.into()), Some(10.into()));
        assert_eq!(map2.get_max_read_up_to_of_theirs(user2, &5.into()), Some(21.into()));

        map2.remove_up_to(user2, 21.into());
        assert!(entries(user2).is_empty());
        assert_eq!(entries(user1), vec![(1.into(), 10.into())]);
    }

    #[test]
    fn entries_on_heap_are_migrated_to_stable_memory() {
        init_stable_memory_map();
        let them = user_id(1);
        let mut map = UnreadMessageIndexMap {
            on_heap: (1..=50)
                .map(|i| (MessageIndex::from(i), MessageIndex::from(i + 100)))
                .collect(),
        };

        assert_eq!(map.migrate_to_stable_memory(them), 50);
        assert!(map.on_heap.is_empty());
        assert_eq!(map.migrate_to_stable_memory(them), 0);

        assert_eq!(
            entries(them),
            (1..=50)
                .map(|i| (MessageIndex::from(i), MessageIndex::from(i + 100)))
                .collect::<Vec<_>>()
        );
        assert_eq!(map.get_max_read_up_to_of_theirs(them, &10.into()), Some(110.into()));
    }

    #[test]
    fn entries_serialized_before_the_migration_are_migrated_to_stable_memory() {
        // The format `UnreadMessageIndexMap` was serialized in before the entries were moved into
        // stable memory
        #[derive(Serialize)]
        struct LegacyUnreadMessageIndexMap {
            map: BTreeMap<MessageIndex, MessageIndex>,
        }

        init_stable_memory_map();
        let them = user_id(1);
        let legacy = LegacyUnreadMessageIndexMap {
            map: [(1.into(), 3.into()), (2.into(), 4.into())].into_iter().collect(),
        };

        let mut map: UnreadMessageIndexMap = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&legacy));

        assert_eq!(map.migrate_to_stable_memory(them), 2);
        assert_eq!(entries(them), vec![(1.into(), 3.into()), (2.into(), 4.into())]);

        // The heap isn't serialized
        let deserialized: UnreadMessageIndexMap = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&map));
        assert!(deserialized.on_heap.is_empty());
    }

    fn entries(them: UserId) -> Vec<(MessageIndex, MessageIndex)> {
        with_map(|m| {
            m.range(all_keys(them))
                .map(|(k, v)| (k.our_message_index(), value_from_bytes(&v)))
                .collect()
        })
    }

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i; 10]).into()
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
