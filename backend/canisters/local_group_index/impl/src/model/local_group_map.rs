use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{ChatId, CyclesTopUp, Version};

#[derive(Serialize, Deserialize, Default)]
pub struct LocalGroupMap {
    groups: HashMap<ChatId, LocalGroup>,
}

impl LocalGroupMap {
    pub fn add(&mut self, chat_id: ChatId, wasm_version: Version) {
        let group = LocalGroup::new(wasm_version);
        self.groups.insert(chat_id, group);
    }

    pub fn delete(&mut self, chat_id: &ChatId) -> bool {
        self.groups.remove(chat_id).is_some()
    }

    pub fn get(&self, chat_id: &ChatId) -> Option<&LocalGroup> {
        self.groups.get(chat_id)
    }

    pub fn get_mut(&mut self, chat_id: &ChatId) -> Option<&mut LocalGroup> {
        self.groups.get_mut(chat_id)
    }

    pub fn mark_cycles_top_up(&mut self, chat_id: &ChatId, top_up: CyclesTopUp) -> bool {
        if let Some(group) = self.groups.get_mut(chat_id) {
            group.mark_cycles_top_up(top_up);
            true
        } else {
            false
        }
    }

    pub fn iter(&self) -> impl Iterator<Item = (&ChatId, &LocalGroup)> {
        self.groups.iter()
    }

    pub fn len(&self) -> usize {
        self.groups.len()
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct LocalGroup {
    pub wasm_version: Version,
    pub upgrade_in_progress: bool,
    pub cycle_top_ups: Vec<CyclesTopUp>,
}

impl LocalGroup {
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

impl LocalGroup {
    pub fn new(wasm_version: Version) -> LocalGroup {
        LocalGroup {
            wasm_version,
            upgrade_in_progress: false,
            cycle_top_ups: Vec::new(),
        }
    }
}
