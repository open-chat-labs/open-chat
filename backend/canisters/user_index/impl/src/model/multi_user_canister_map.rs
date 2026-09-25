use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::collections::hash_map::Entry;
use types::{CanisterId, MAX_USER_INDEX, TimestampMillis, UserId};

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
    // Set once a user has been given the last index, since indexes aren't reused so the canister
    // can take no more users, however many have since been deleted
    #[serde(default)]
    pub full: bool,
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
                    full: false,
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

    // The LocalUserIndex controlling whichever of the canisters which aren't full has the fewest
    // users, skipping those controlled by a LocalUserIndex which isn't `accepting_users`
    pub fn local_user_index_for_new_user(&self, accepting_users: impl Fn(&CanisterId) -> bool) -> Option<CanisterId> {
        self.canisters
            .iter()
            .filter(|(_, c)| !c.full && accepting_users(&c.local_user_index))
            .min_by_key(|(canister_id, c)| (c.user_count, **canister_id))
            .map(|(_, c)| c.local_user_index)
    }

    // Users held in their own canister are ignored, so this can be called for any user
    pub fn on_user_added(&mut self, user_id: &UserId) {
        if let Some(canister) = self.canister_holding_mut(user_id) {
            canister.user_count = canister.user_count.saturating_add(1);
            if user_id.index() == MAX_USER_INDEX {
                canister.full = true;
            }
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
                full: false,
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

    #[test]
    fn round_trips() {
        let mut map = MultiUserCanisterMap::default();
        map.add(canister_id(1), canister_id(100), 10);
        map.on_user_added(&UserId::new_indexed(canister_id(1), 1));

        let bytes = msgpack::serialize_then_unwrap(&map);
        let map: MultiUserCanisterMap = msgpack::deserialize_then_unwrap(&bytes);
        assert_eq!(
            map.canisters.get(&canister_id(1)),
            Some(&MultiUserCanister {
                date_created: 10,
                local_user_index: canister_id(100),
                user_count: 1,
                full: false,
            })
        );
    }

    #[test]
    fn local_user_index_for_new_user_picks_the_canister_with_the_fewest_users() {
        let mut map = MultiUserCanisterMap::default();
        assert_eq!(map.local_user_index_for_new_user(|_| true), None);

        map.add(canister_id(1), canister_id(101), 0);
        map.add(canister_id(2), canister_id(102), 0);
        map.add(canister_id(3), canister_id(103), 0);
        for (canister, users) in [(1, 3), (2, 1), (3, 2)] {
            for index in 1..=users {
                map.on_user_added(&UserId::new_indexed(canister_id(canister), index));
            }
        }
        assert_eq!(map.local_user_index_for_new_user(|_| true), Some(canister_id(102)));

        // Canisters controlled by a LocalUserIndex which isn't accepting users are skipped
        assert_eq!(
            map.local_user_index_for_new_user(|c| *c != canister_id(102)),
            Some(canister_id(103))
        );

        // As are full ones, however few users they hold
        map.on_user_added(&UserId::new_indexed(canister_id(2), MAX_USER_INDEX));
        map.on_user_removed(&UserId::new_indexed(canister_id(2), 1));
        map.on_user_removed(&UserId::new_indexed(canister_id(2), MAX_USER_INDEX));
        assert_eq!(map.local_user_index_for_new_user(|_| true), Some(canister_id(103)));
        assert_eq!(map.local_user_index_for_new_user(|c| *c == canister_id(102)), None);
    }
}
