use ic_principal::Principal;
use serde::{Deserialize, Serialize};
use stable_memory_map::{Key, KeyPrefix, LazyValue, PrincipalKey, PrincipalKeyPrefix, StableMemoryMap, with_map, with_map_mut};
use std::collections::BTreeMap;
use std::ops::Bound;
use types::UserId;

#[derive(Serialize, Deserialize)]
pub struct PrincipalToUserIdMap {
    prefix: PrincipalKeyPrefix,
    count: u32,
}

impl StableMemoryMap<PrincipalKeyPrefix, UserId> for PrincipalToUserIdMap {
    fn prefix(&self) -> &PrincipalKeyPrefix {
        &self.prefix
    }

    fn value_to_bytes(value: UserId) -> Vec<u8> {
        value.as_slice().to_vec()
    }

    fn bytes_to_value(_key: &Principal, bytes: Vec<u8>) -> UserId {
        UserId::from(Principal::from_slice(&bytes))
    }

    fn on_inserted(&mut self, _key: &Principal, existing: &Option<LazyValue<Principal, UserId>>) {
        if existing.is_none() {
            self.count = self.count.saturating_add(1);
        }
    }

    fn on_removed(&mut self, _key: &Principal, _removed: &LazyValue<Principal, UserId>) {
        self.count = self.count.saturating_sub(1);
    }
}

impl PrincipalToUserIdMap {
    // Inserts the entries together, so that each node of the stable memory map is written once rather
    // than once per entry (see `StableMemoryMapInner::insert_many`). Each principal is looked up first
    // to keep the count, and those already mapped to the user id given are left as they are. Where a
    // principal is given more than once, the last user id given for it is kept.
    pub fn insert_many(&mut self, entries: impl IntoIterator<Item = (Principal, UserId)>) {
        // By key, which is the order they're written in, whereas principals are ordered by length first
        let mut by_key = BTreeMap::new();
        for (principal, user_id) in entries {
            by_key.insert(self.prefix.create_key(&principal), (principal, user_id));
        }

        let mut to_write = Vec::new();
        for (key, (principal, user_id)) in by_key {
            match self.get(&principal) {
                Some(existing) if existing == user_id => continue,
                Some(_) => {}
                None => self.count = self.count.saturating_add(1),
            }
            to_write.push((key, Self::value_to_bytes(user_id)));
        }
        with_map_mut(|m| m.insert_many(to_write));
    }

    pub fn len(&self) -> u32 {
        self.count
    }

    pub fn is_empty(&self) -> bool {
        self.count == 0
    }

    // Passes the user ids of up to `max_count` entries, in key order starting after the entry for
    // `after`, through `f`, replacing each with the id returned. Returns the principal of the last
    // entry passed if there may be more after it, otherwise None.
    pub fn update_user_ids(
        &mut self,
        after: Option<Principal>,
        max_count: usize,
        f: &mut dyn FnMut(UserId) -> UserId,
    ) -> Option<Principal> {
        let start = match after {
            Some(principal) => Bound::Excluded(self.prefix.create_key(&principal)),
            None => Bound::Included(self.prefix.create_key(&Principal::from_slice(&[]))),
        };
        let entries: Vec<(PrincipalKey, UserId)> = with_map(|m| {
            m.range((start, Bound::Unbounded))
                .take_while(|(k, _)| k.matches_prefix(&self.prefix))
                .take(max_count)
                .map(|(k, v)| (k, UserId::from(Principal::from_slice(&v))))
                .collect()
        });
        let last = entries
            .last()
            .filter(|_| entries.len() == max_count)
            .map(|(k, _)| k.principal());

        // The entries are already in key order, so are written back in bulk
        let updated: Vec<_> = entries
            .into_iter()
            .filter_map(|(key, user_id)| {
                let latest = f(user_id);
                (latest != user_id).then(|| (key, Self::value_to_bytes(latest)))
            })
            .collect();
        with_map_mut(|m| m.insert_many(updated));
        last
    }
}

impl Default for PrincipalToUserIdMap {
    fn default() -> Self {
        PrincipalToUserIdMap {
            prefix: PrincipalKeyPrefix::new_for_principal_to_user_id_map(),
            count: 0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};

    #[test]
    fn insert_many_matches_inserting_one_at_a_time() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init(memory.get(MemoryId::new(1)));

        // Principals of different lengths, so that their order differs from that of their keys, one
        // already mapped to the same user id, one remapped, and one given twice
        let principal = |bytes: &[u8]| Principal::from_slice(bytes);
        let user_id = |i: u8| UserId::from(Principal::from_slice(&[100, i]));
        let existing = [(principal(&[5]), user_id(1)), (principal(&[6, 1]), user_id(2))];
        let entries = [
            (principal(&[9, 9, 9]), user_id(3)),
            (principal(&[5]), user_id(1)),
            (principal(&[6, 1]), user_id(4)),
            (principal(&[2, 7]), user_id(5)),
            (principal(&[8]), user_id(6)),
            (principal(&[2, 7]), user_id(7)),
        ];

        let mut one_at_a_time = PrincipalToUserIdMap::default();
        for (p, u) in existing.into_iter().chain(entries) {
            one_at_a_time.insert(p, u);
        }
        let expected = contents();

        stable_memory_map::init(memory.get(MemoryId::new(2)));
        let mut together = PrincipalToUserIdMap::default();
        for (p, u) in existing {
            together.insert(p, u);
        }
        together.insert_many(entries);

        assert_eq!(contents(), expected);
        assert_eq!(together.len(), one_at_a_time.len());
        assert_eq!(together.len(), 5);
        assert_eq!(together.get(&principal(&[2, 7])), Some(user_id(7)));
    }

    fn contents() -> Vec<(Vec<u8>, Vec<u8>)> {
        let prefix = PrincipalKeyPrefix::new_for_principal_to_user_id_map();
        stable_memory_map::with_map(|m| {
            m.range(prefix.create_key(&Principal::from_slice(&[]))..)
                .map(|(k, v)| (k.as_ref().to_vec(), v))
                .collect()
        })
    }
}
