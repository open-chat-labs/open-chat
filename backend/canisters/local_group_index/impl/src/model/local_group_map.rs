use local_user_index_canister::LocalGroup;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{BuildVersion, ChatId, CyclesTopUp};

#[derive(Serialize, Deserialize, Default)]
pub struct LocalGroupMap {
    groups: HashMap<ChatId, LocalGroup>,
}

impl LocalGroupMap {
    pub fn add(&mut self, chat_id: ChatId, wasm_version: BuildVersion) {
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
