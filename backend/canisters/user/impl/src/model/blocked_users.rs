use candid::Principal;
use serde::{Deserialize, Serialize};
use stable_memory_map::{BlockedUserKey, BlockedUserKeyPrefix, KeyPrefix, with_map, with_map_mut};
use std::collections::HashSet;
use std::ops::RangeInclusive;
use types::{TimestampMillis, UserId};

// The users the user has blocked, stored in the stable memory map for small entries keyed by user
// id, with empty values
#[derive(Serialize, Deserialize, Default)]
pub struct BlockedUsers {
    // The users which were held on the heap, which are all moved into stable memory in
    // `post_upgrade` by `migrate_to_stable_memory`, so this is always empty otherwise.
    // TODO: Remove this after next release
    #[serde(rename = "v", default, skip_serializing)]
    on_heap: HashSet<UserId>,
    // When a user was last blocked or unblocked. This field was previously the timestamp of a
    // `Timestamped<HashSet<UserId>>`, hence the name.
    #[serde(rename = "t")]
    last_updated: TimestampMillis,
    #[serde(rename = "c", default)]
    count: u32,
}

impl BlockedUsers {
    // Returns true if the user wasn't already blocked
    pub fn block(&mut self, user_id: UserId, now: TimestampMillis) -> bool {
        if with_map_mut(|m| m.insert(key(user_id), Vec::new())).is_none() {
            self.count += 1;
            self.last_updated = now;
            true
        } else {
            false
        }
    }

    // Returns true if the user was blocked
    pub fn unblock(&mut self, user_id: UserId, now: TimestampMillis) -> bool {
        if with_map_mut(|m| m.remove(key(user_id))).is_some() {
            self.count = self.count.saturating_sub(1);
            self.last_updated = now;
            true
        } else {
            false
        }
    }

    pub fn contains(&self, user_id: &UserId) -> bool {
        // Most users haven't blocked anyone, so avoid reading from stable memory in that case
        self.count > 0 && with_map(|m| m.contains_key(key(*user_id)))
    }

    // Returns every blocked user, ordered by user id
    pub fn all(&self) -> Vec<UserId> {
        if self.count == 0 {
            return Vec::new();
        }
        with_map(|m| m.range(all_keys()).map(|(key, _)| key.user_id()).collect())
    }

    // Returns every blocked user if any user has been blocked or unblocked since `since`
    pub fn if_updated_since(&self, since: TimestampMillis) -> Option<Vec<UserId>> {
        (self.last_updated > since).then(|| self.all())
    }

    pub fn len(&self) -> usize {
        self.count as usize
    }

    // Moves the users which were held on the heap into stable memory, returning how many were moved
    // TODO: Remove this after next release
    pub fn migrate_to_stable_memory(&mut self) -> usize {
        if self.on_heap.is_empty() {
            return 0;
        }

        let mut entries: Vec<_> = std::mem::take(&mut self.on_heap)
            .into_iter()
            .map(|user_id| (key(user_id), Vec::new()))
            .collect();
        // Insert the entries in key order
        entries.sort_unstable_by(|(a, _), (b, _)| a.cmp(b));

        let count = entries.len();
        with_map_mut(|m| m.insert_many(entries));
        self.count += count as u32;
        count
    }
}

fn key(user_id: UserId) -> BlockedUserKey {
    BlockedUserKeyPrefix::new().create_key(&user_id)
}

fn all_keys() -> RangeInclusive<BlockedUserKey> {
    // User ids are at most 29 bytes
    let prefix = BlockedUserKeyPrefix::new();
    prefix.create_key(&UserId::new(Principal::from_slice(&[])))
        ..=prefix.create_key(&UserId::new(Principal::from_slice(&[u8::MAX; 29])))
}

#[cfg(test)]
mod tests {
    use super::*;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use types::Timestamped;

    #[test]
    fn users_can_be_blocked_and_unblocked() {
        init_stable_memory_map();
        let mut blocked_users = BlockedUsers::default();
        assert!(!blocked_users.contains(&user_id(1)));
        assert!(blocked_users.all().is_empty());
        assert!(blocked_users.if_updated_since(0).is_none());

        for (i, now) in [(3, 10), (1, 20), (2, 30)] {
            assert!(blocked_users.block(user_id(i), now));
        }
        assert!(!blocked_users.block(user_id(2), 100));
        assert_eq!(blocked_users.len(), 3);
        assert_eq!(blocked_users.all(), vec![user_id(1), user_id(2), user_id(3)]);
        assert!(blocked_users.contains(&user_id(2)));
        assert!(!blocked_users.contains(&user_id(4)));

        // Blocking an already blocked user isn't an update
        assert_eq!(
            blocked_users.if_updated_since(29),
            Some(vec![user_id(1), user_id(2), user_id(3)])
        );
        assert!(blocked_users.if_updated_since(30).is_none());

        assert!(blocked_users.unblock(user_id(1), 40));
        assert!(!blocked_users.unblock(user_id(1), 50));
        assert!(!blocked_users.unblock(user_id(4), 50));
        assert_eq!(blocked_users.len(), 2);
        assert_eq!(blocked_users.all(), vec![user_id(2), user_id(3)]);
        assert!(!blocked_users.contains(&user_id(1)));
        assert_eq!(blocked_users.if_updated_since(30), Some(vec![user_id(2), user_id(3)]));
        assert!(blocked_users.if_updated_since(40).is_none());
    }

    #[test]
    fn blocked_users_on_heap_are_migrated_to_stable_memory() {
        init_stable_memory_map();

        // The blocked users serialized by the previous version
        let previous = Timestamped::new((1..=50).map(user_id).collect::<HashSet<_>>(), 1000);
        let mut blocked_users: BlockedUsers = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&previous));
        assert_eq!(blocked_users.last_updated, 1000);

        assert_eq!(blocked_users.migrate_to_stable_memory(), 50);
        assert!(blocked_users.on_heap.is_empty());
        assert_eq!(blocked_users.migrate_to_stable_memory(), 0);

        assert_eq!(blocked_users.len(), 50);
        assert_eq!(blocked_users.all(), (1..=50).map(user_id).collect::<Vec<_>>());
        assert!(blocked_users.contains(&user_id(20)));
        assert_eq!(blocked_users.if_updated_since(999).map(|u| u.len()), Some(50));
        assert!(blocked_users.if_updated_since(1000).is_none());

        // Migrated users can be unblocked
        assert!(blocked_users.unblock(user_id(20), 2000));
        assert!(!blocked_users.contains(&user_id(20)));
        assert_eq!(blocked_users.len(), 49);

        // The heap isn't serialized
        let deserialized: BlockedUsers = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&blocked_users));
        assert!(deserialized.on_heap.is_empty());
        assert_eq!(deserialized.len(), 49);
        assert_eq!(deserialized.last_updated, 2000);
        assert_eq!(deserialized.all().len(), 49);
    }

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i; 10]).into()
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
