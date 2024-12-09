use candid::Principal;
use constants::MINUTE_IN_MS;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::{BuildVersion, CyclesTopUp, TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct LocalUserMap {
    users: HashMap<UserId, LocalUser>,
    registration_in_progress: HashMap<Principal, TimestampMillis>,
}

impl LocalUserMap {
    pub fn add(&mut self, user_id: UserId, principal: Principal, wasm_version: BuildVersion, now: TimestampMillis) {
        let user = LocalUser::new(now, wasm_version);
        self.users.insert(user_id, user);
        self.registration_in_progress.remove(&principal);
    }

    pub fn get(&self, user_id: &UserId) -> Option<&LocalUser> {
        self.users.get(user_id)
    }

    pub fn get_mut(&mut self, user_id: &UserId) -> Option<&mut LocalUser> {
        self.users.get_mut(user_id)
    }

    pub fn contains(&self, user_id: &UserId) -> bool {
        self.users.contains_key(user_id)
    }

    pub fn remove(&mut self, user_id: &UserId) -> bool {
        self.users.remove(user_id).is_some()
    }

    pub fn mark_cycles_top_up(&mut self, user_id: &UserId, top_up: CyclesTopUp) -> bool {
        if let Some(user) = self.users.get_mut(user_id) {
            user.mark_cycles_top_up(top_up);
            true
        } else {
            false
        }
    }

    pub fn mark_registration_in_progress(&mut self, principal: Principal, now: TimestampMillis) -> bool {
        match self.registration_in_progress.entry(principal) {
            Vacant(e) => {
                e.insert(now);
                true
            }
            Occupied(mut e) if *e.get() < now.saturating_sub(5 * MINUTE_IN_MS) => {
                e.insert(now);
                true
            }
            Occupied(_) => false,
        }
    }

    pub fn mark_registration_failed(&mut self, principal: &Principal) {
        self.registration_in_progress.remove(principal);
    }

    pub fn iter(&self) -> impl Iterator<Item = (&UserId, &LocalUser)> {
        self.users.iter()
    }

    pub fn len(&self) -> usize {
        self.users.len()
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct LocalUser {
    pub date_created: TimestampMillis,
    pub wasm_version: BuildVersion,
    pub upgrade_in_progress: bool,
    pub cycle_top_ups: Vec<CyclesTopUp>,
}

impl LocalUser {
    pub fn set_canister_upgrade_status(&mut self, upgrade_in_progress: bool, new_version: Option<BuildVersion>) {
        self.upgrade_in_progress = upgrade_in_progress;
        if let Some(version) = new_version {
            self.wasm_version = version;
        }
    }

    pub fn mark_cycles_top_up(&mut self, top_up: CyclesTopUp) {
        self.cycle_top_ups.push(top_up)
    }
}

impl LocalUser {
    pub fn new(now: TimestampMillis, wasm_version: BuildVersion) -> LocalUser {
        LocalUser {
            date_created: now,
            wasm_version,
            upgrade_in_progress: false,
            cycle_top_ups: Vec::new(),
        }
    }
}
