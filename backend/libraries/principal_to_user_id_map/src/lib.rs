use ic_principal::Principal;
use serde::{Deserialize, Serialize};
use stable_memory_map::{Key, KeyPrefix, LazyValue, PrincipalKey, PrincipalKeyPrefix, StableMemoryMap, with_map, with_map_mut};
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
