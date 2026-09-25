use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::collections::hash_map::Entry;
use types::{CanisterId, TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct MultiUserCanisterMap {
    canisters: HashMap<CanisterId, MultiUserCanister>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct MultiUserCanister {
    pub date_created: TimestampMillis,
    // The LocalUserIndex which controls the canister
    pub local_user_index: CanisterId,
    pub user_count: u32,
}

impl MultiUserCanisterMap {
    // Returns false if the canister is already known, in which case it is left untouched
    pub fn add(&mut self, canister_id: CanisterId, local_user_index: CanisterId, now: TimestampMillis) -> bool {
        match self.canisters.entry(canister_id) {
            Entry::Vacant(e) => {
                e.insert(MultiUserCanister {
                    date_created: now,
                    local_user_index,
                    user_count: 0,
                });
                true
            }
            Entry::Occupied(_) => false,
        }
    }

    pub fn contains(&self, canister_id: &CanisterId) -> bool {
        self.canisters.contains_key(canister_id)
    }

    pub fn local_user_index(&self, canister_id: &CanisterId) -> Option<CanisterId> {
        self.canisters.get(canister_id).map(|c| c.local_user_index)
    }

    // Users held in their own canister are ignored, so this can be called for any user
    pub fn on_user_added(&mut self, user_id: &UserId) {
        if let Some(canister) = self.canister_holding_mut(user_id) {
            canister.user_count = canister.user_count.saturating_add(1);
        }
    }

    // Users held in their own canister are ignored, so this can be called for any user
    pub fn on_user_removed(&mut self, user_id: &UserId) {
        if let Some(canister) = self.canister_holding_mut(user_id) {
            canister.user_count = canister.user_count.saturating_sub(1);
        }
    }

    pub fn iter(&self) -> impl Iterator<Item = (&CanisterId, &MultiUserCanister)> {
        self.canisters.iter()
    }

    fn canister_holding_mut(&mut self, user_id: &UserId) -> Option<&mut MultiUserCanister> {
        if user_id.is_indexed() { self.canisters.get_mut(&user_id.canister_id()) } else { None }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    fn canister_id(i: u64) -> CanisterId {
        Principal::from_slice(&[&i.to_be_bytes()[..], &[1, 1]].concat())
    }

    #[test]
    fn add_is_a_no_op_for_a_known_canister() {
        let mut map = MultiUserCanisterMap::default();
        assert!(map.add(canister_id(1), canister_id(100), 10));
        map.on_user_added(&UserId::new_indexed(canister_id(1), 1));

        assert!(!map.add(canister_id(1), canister_id(101), 20));
        assert_eq!(
            map.iter().next().map(|(_, c)| c.clone()),
            Some(MultiUserCanister {
                date_created: 10,
                local_user_index: canister_id(100),
                user_count: 1,
            })
        );
    }

    #[test]
    fn user_count_tracks_users_of_each_canister() {
        let mut map = MultiUserCanisterMap::default();
        map.add(canister_id(1), canister_id(100), 0);
        map.add(canister_id(2), canister_id(100), 0);

        map.on_user_added(&UserId::new_indexed(canister_id(1), 1));
        map.on_user_added(&UserId::new_indexed(canister_id(1), 2));
        map.on_user_added(&UserId::new_indexed(canister_id(2), 1));
        // Neither a user in their own canister nor one in an unknown MultiUser canister is counted
        map.on_user_added(&UserId::new(canister_id(1)));
        map.on_user_added(&UserId::new_indexed(canister_id(3), 1));
        map.on_user_removed(&UserId::new_indexed(canister_id(2), 1));
        map.on_user_removed(&UserId::new_indexed(canister_id(2), 1));

        let user_count = |c| map.canisters.get(&canister_id(c)).map(|c| c.user_count);
        assert_eq!(user_count(1), Some(2));
        assert_eq!(user_count(2), Some(0));
        assert_eq!(user_count(3), None);
    }
}
