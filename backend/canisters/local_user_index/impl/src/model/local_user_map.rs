use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{CyclesTopUp, TimestampMillis, UserId, Version};

#[derive(Serialize, Deserialize, Default)]
pub struct LocalUserMap {
    users: HashMap<UserId, LocalUser>,
}

impl LocalUserMap {
    pub fn create(&mut self, user_id: UserId, wasm_version: Version, now: TimestampMillis) {
        let user = LocalUser::new(now, wasm_version);
        self.users.insert(user_id, user);
    }

    pub fn get(&self, user_id: &UserId) -> Option<&LocalUser> {
        self.users.get(user_id)
    }

    pub fn get_mut(&mut self, user_id: &UserId) -> Option<&mut LocalUser> {
        self.users.get_mut(user_id)
    }

    pub fn mark_cycles_top_up(&mut self, user_id: &UserId, top_up: CyclesTopUp) -> bool {
        if let Some(user) = self.users.get_mut(user_id) {
            user.mark_cycles_top_up(top_up);
            true
        } else {
            false
        }
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
    pub wasm_version: Version,
    pub upgrade_in_progress: bool,
    pub cycle_top_ups: Vec<CyclesTopUp>,
}

impl LocalUser {
    pub fn set_canister_upgrade_status(&mut self, upgrade_in_progress: bool, new_version: Option<Version>) {
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
    pub fn new(now: TimestampMillis, wasm_version: Version) -> LocalUser {
        LocalUser {
            date_created: now,
            wasm_version,
            upgrade_in_progress: false,
            cycle_top_ups: Vec::new(),
        }
    }
}
