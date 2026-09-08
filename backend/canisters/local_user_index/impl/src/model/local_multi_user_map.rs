use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{BuildVersion, CanisterId, CyclesTopUp};

#[derive(Serialize, Deserialize, Default)]
pub struct LocalMultiUserMap {
    canisters: HashMap<CanisterId, LocalMultiUser>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LocalMultiUser {
    pub wasm_version: BuildVersion,
    pub upgrade_in_progress: bool,
    pub cycle_top_ups: Vec<CyclesTopUp>,
}

impl LocalMultiUserMap {
    pub fn add(&mut self, canister_id: CanisterId, wasm_version: BuildVersion) {
        self.canisters.insert(
            canister_id,
            LocalMultiUser {
                wasm_version,
                upgrade_in_progress: false,
                cycle_top_ups: Vec::new(),
            },
        );
    }

    pub fn get_mut(&mut self, canister_id: &CanisterId) -> Option<&mut LocalMultiUser> {
        self.canisters.get_mut(canister_id)
    }

    pub fn mark_cycles_top_up(&mut self, canister_id: &CanisterId, top_up: CyclesTopUp) -> bool {
        if let Some(canister) = self.canisters.get_mut(canister_id) {
            canister.cycle_top_ups.push(top_up);
            true
        } else {
            false
        }
    }

    pub fn iter(&self) -> impl Iterator<Item = (&CanisterId, &LocalMultiUser)> {
        self.canisters.iter()
    }

    pub fn len(&self) -> usize {
        self.canisters.len()
    }
}

impl LocalMultiUser {
    pub fn set_canister_upgrade_status(&mut self, upgrade_in_progress: bool, new_version: Option<BuildVersion>) {
        self.upgrade_in_progress = upgrade_in_progress;
        if let Some(version) = new_version {
            self.wasm_version = version;
        }
    }
}
