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
            },
        );
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
