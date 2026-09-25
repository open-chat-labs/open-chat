use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{BuildVersion, CanisterId, CyclesTopUp, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct LocalMultiUserCanisterMap {
    canisters: HashMap<CanisterId, LocalMultiUserCanister>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LocalMultiUserCanister {
    pub wasm_version: BuildVersion,
    pub upgrade_in_progress: bool,
    pub cycle_top_ups: Vec<CyclesTopUp>,
    #[serde(default)]
    pub created: TimestampMillis,
    #[serde(default)]
    pub user_count: u32,
    // Set once the canister rejects a new user because it has given out every index. Indexes
    // aren't reused, so it can take no more users, however many have since been deleted
    #[serde(default)]
    pub full: bool,
}

impl LocalMultiUserCanisterMap {
    pub fn add(&mut self, canister_id: CanisterId, wasm_version: BuildVersion, now: TimestampMillis) {
        self.canisters.insert(
            canister_id,
            LocalMultiUserCanister {
                wasm_version,
                upgrade_in_progress: false,
                cycle_top_ups: Vec::new(),
                created: now,
                user_count: 0,
                full: false,
            },
        );
    }

    pub fn on_user_added(&mut self, canister_id: &CanisterId) {
        if let Some(canister) = self.canisters.get_mut(canister_id) {
            canister.user_count = canister.user_count.saturating_add(1);
        }
    }

    // Of the canisters which are neither full nor being upgraded, the one with the fewest users, so
    // that users are spread evenly across them
    pub fn canister_for_new_user(&self) -> Option<(CanisterId, BuildVersion)> {
        self.canisters
            .iter()
            .filter(|(_, c)| !c.full && !c.upgrade_in_progress)
            .min_by_key(|(canister_id, c)| (c.user_count, **canister_id))
            .map(|(canister_id, c)| (*canister_id, c.wasm_version))
    }

    pub fn mark_full(&mut self, canister_id: &CanisterId) {
        if let Some(canister) = self.canisters.get_mut(canister_id) {
            canister.full = true;
        }
    }

    pub fn on_user_removed(&mut self, canister_id: &CanisterId) {
        if let Some(canister) = self.canisters.get_mut(canister_id) {
            canister.user_count = canister.user_count.saturating_sub(1);
        }
    }

    pub fn get(&self, canister_id: &CanisterId) -> Option<&LocalMultiUserCanister> {
        self.canisters.get(canister_id)
    }

    pub fn get_mut(&mut self, canister_id: &CanisterId) -> Option<&mut LocalMultiUserCanister> {
        self.canisters.get_mut(canister_id)
    }

    pub fn contains(&self, canister_id: &CanisterId) -> bool {
        self.canisters.contains_key(canister_id)
    }

    pub fn mark_cycles_top_up(&mut self, canister_id: &CanisterId, top_up: CyclesTopUp) -> bool {
        if let Some(canister) = self.canisters.get_mut(canister_id) {
            canister.cycle_top_ups.push(top_up);
            true
        } else {
            false
        }
    }

    pub fn iter(&self) -> impl Iterator<Item = (&CanisterId, &LocalMultiUserCanister)> {
        self.canisters.iter()
    }

    pub fn len(&self) -> usize {
        self.canisters.len()
    }
}

impl LocalMultiUserCanister {
    pub fn set_canister_upgrade_status(&mut self, upgrade_in_progress: bool, new_version: Option<BuildVersion>) {
        self.upgrade_in_progress = upgrade_in_progress;
        if let Some(version) = new_version {
            self.wasm_version = version;
        }
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
    fn canister_for_new_user_picks_the_canister_with_the_fewest_users() {
        let mut map = LocalMultiUserCanisterMap::default();
        assert_eq!(map.canister_for_new_user(), None);

        let version = BuildVersion::min();
        // The newest canister isn't favoured
        map.add(canister_id(1), version, 1);
        map.add(canister_id(2), version, 2);
        map.add(canister_id(3), version, 3);
        for (canister, users) in [(1, 1), (2, 3), (3, 2)] {
            for _ in 0..users {
                map.on_user_added(&canister_id(canister));
            }
        }
        assert_eq!(map.canister_for_new_user(), Some((canister_id(1), version)));

        // Canisters being upgraded are skipped
        map.get_mut(&canister_id(1)).unwrap().set_canister_upgrade_status(true, None);
        assert_eq!(map.canister_for_new_user(), Some((canister_id(3), version)));

        // As are full ones, however few users they hold
        map.mark_full(&canister_id(3));
        map.on_user_removed(&canister_id(3));
        map.on_user_removed(&canister_id(3));
        assert_eq!(map.canister_for_new_user(), Some((canister_id(2), version)));

        map.mark_full(&canister_id(2));
        assert_eq!(map.canister_for_new_user(), None);
    }
}
