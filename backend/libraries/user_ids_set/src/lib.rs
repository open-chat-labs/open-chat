use ic_principal::Principal;
use serde::{Deserialize, Serialize};
use stable_memory_map::{KeyPrefix, LazyValue, StableMemoryMap, UserIdsKeyPrefix, with_map};
use std::collections::HashMap;
use types::{CanisterId, UserId};

#[derive(Serialize, Deserialize)]
pub struct UserIdsSet {
    prefix: UserIdsKeyPrefix,
    len: u32,
}

impl StableMemoryMap<UserIdsKeyPrefix, ()> for UserIdsSet {
    fn prefix(&self) -> &UserIdsKeyPrefix {
        &self.prefix
    }

    fn value_to_bytes(_value: ()) -> Vec<u8> {
        Vec::new()
    }

    fn bytes_to_value(_key: &(UserId, UserId), _bytes: Vec<u8>) {}

    fn on_inserted(&mut self, _key: &(UserId, UserId), existing: &Option<LazyValue<(UserId, UserId), ()>>) {
        if existing.is_none() {
            self.len = self.len.saturating_add(1);
        }
    }

    fn on_removed(&mut self, _key: &(UserId, UserId), _removed: &LazyValue<(UserId, UserId), ()>) {
        self.len = self.len.saturating_sub(1);
    }
}

impl UserIdsSet {
    pub fn new(prefix: UserIdsKeyPrefix) -> Self {
        Self { prefix, len: 0 }
    }

    pub fn len(&self) -> u32 {
        self.len
    }

    pub fn is_empty(&self) -> bool {
        self.len == 0
    }

    pub fn all_linked_users<I: FromIterator<UserId>>(&self, user_id1: UserId) -> I {
        with_map(|m| {
            m.range(self.prefix.create_key(&(user_id1, Principal::from_slice(&[]).into()))..)
                .take_while(|(key, _)| key.user_ids().0 == user_id1)
                .map(|(key, _)| key.user_ids().1)
                .collect()
        })
    }

    // The users paired with the given user when they are second in the pair. Pairs are keyed by the
    // first user, so this scans the whole set.
    pub fn all_users_linked_to<I: FromIterator<UserId>>(&self, user_id2: UserId) -> I {
        let min_user_id = UserId::new(CanisterId::from_slice(&[]));
        with_map(|m| {
            m.range(self.prefix.create_key(&(min_user_id, min_user_id))..)
                .filter_map(|(key, _)| {
                    let (user_id1, u) = key.user_ids();
                    (u == user_id2).then_some(user_id1)
                })
                .collect()
        })
    }

    // Moves every pair naming the user onto the new id they were given when migrated to a MultiUser
    // canister. The pairs in which they are first are found by their key, whereas those in which they
    // are second would take a scan of the whole set to find, so the users paired with them in those,
    // as returned by `all_users_linked_to`, are passed in.
    pub fn migrate_user_id(&mut self, old_user_id: UserId, new_user_id: UserId, users_linked_to_old_user_id: &[UserId]) {
        let migrate = |user_id| if user_id == old_user_id { new_user_id } else { user_id };

        let linked_users: Vec<UserId> = self.all_linked_users(old_user_id);
        for user_id2 in linked_users {
            self.remove(&(old_user_id, user_id2));
            self.insert((new_user_id, migrate(user_id2)), ());
        }
        for &user_id1 in users_linked_to_old_user_id {
            if self.remove(&(user_id1, old_user_id)).is_some() {
                self.insert((migrate(user_id1), new_user_id), ());
            }
        }
    }

    pub fn collect_all(&self) -> Vec<(UserId, Vec<UserId>)> {
        let min_user_id = UserId::new(CanisterId::from_slice(&[]));
        with_map(|m| {
            let mut map: HashMap<UserId, Vec<UserId>> = HashMap::new();
            for (key, _) in m.range(self.prefix.create_key(&(min_user_id, min_user_id))..) {
                let (user_id1, user_id2) = key.user_ids();
                map.entry(user_id1).or_default().push(user_id2);
            }
            map.into_iter().collect()
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};

    #[test]
    fn pairs_naming_a_migrated_user_are_moved_onto_their_new_id() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init(memory.get(MemoryId::new(1)));

        let user_id = |i: u8| -> UserId { Principal::from_slice(&[i]).into() };
        let (old_user_id, new_user_id, user2, user3) = (user_id(1), user_id(10), user_id(2), user_id(3));
        let mut set = UserIdsSet::new(UserIdsKeyPrefix::new_for_blocked_users());

        // The migrated user has blocked user2, and been blocked by user2 and user3, while user2 has
        // also blocked user3
        set.insert((user2, old_user_id), ());
        set.insert((old_user_id, user2), ());
        set.insert((old_user_id, user3), ());
        set.insert((user3, user2), ());

        let users_linked_to_old_user_id: Vec<_> = set.all_users_linked_to(old_user_id);
        assert_eq!(users_linked_to_old_user_id, vec![user2]);
        // user3, who isn't paired with the migrated user that way round, is ignored
        set.migrate_user_id(old_user_id, new_user_id, &[user2, user3]);

        let mut pairs: Vec<_> = set
            .collect_all()
            .into_iter()
            .flat_map(|(user_id1, user_ids)| user_ids.into_iter().map(move |user_id2| (user_id1, user_id2)))
            .collect();
        pairs.sort();
        let mut expected = vec![
            (user2, new_user_id),
            (new_user_id, user2),
            (new_user_id, user3),
            (user3, user2),
        ];
        expected.sort();
        assert_eq!(pairs, expected);
        assert_eq!(set.len(), 4);
        assert!(set.all_linked_users::<Vec<_>>(old_user_id).is_empty());
        assert!(set.all_users_linked_to::<Vec<_>>(old_user_id).is_empty());
    }
}
