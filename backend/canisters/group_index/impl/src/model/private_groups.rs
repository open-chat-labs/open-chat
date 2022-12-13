use crate::MARK_ACTIVE_DURATION;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::{ChatId, Cycles, CyclesTopUp, FrozenGroupInfo, TimestampMillis, Version};

#[derive(CandidType, Serialize, Deserialize, Default)]
pub struct PrivateGroups {
    groups: HashMap<ChatId, PrivateGroupInfo>,
}

impl PrivateGroups {
    pub fn len(&self) -> usize {
        self.groups.len()
    }

    pub fn get(&self, chat_id: &ChatId) -> Option<&PrivateGroupInfo> {
        self.groups.get(chat_id)
    }

    pub fn get_mut(&mut self, chat_id: &ChatId) -> Option<&mut PrivateGroupInfo> {
        self.groups.get_mut(chat_id)
    }

    pub fn handle_group_created(
        &mut self,
        chat_id: ChatId,
        now: TimestampMillis,
        wasm_version: Version,
        cycles: Cycles,
    ) -> bool {
        match self.groups.entry(chat_id) {
            Occupied(_) => false,
            Vacant(e) => {
                let group_info = PrivateGroupInfo::new(chat_id, now, wasm_version, cycles);
                e.insert(group_info);
                true
            }
        }
    }

    pub fn add_existing(&mut self, private_group_info: PrivateGroupInfo) -> bool {
        match self.groups.entry(private_group_info.id()) {
            Occupied(_) => false,
            Vacant(e) => {
                e.insert(private_group_info);
                true
            }
        }
    }

    pub fn delete(&mut self, chat_id: &ChatId) -> bool {
        self.groups.remove(chat_id).is_some()
    }

    pub fn iter(&self) -> impl Iterator<Item = &PrivateGroupInfo> {
        self.groups.values()
    }
}

#[derive(CandidType, Serialize, Deserialize)]
pub struct PrivateGroupInfo {
    id: ChatId,
    created: TimestampMillis,
    marked_active_until: TimestampMillis,
    wasm_version: Version,
    cycle_top_ups: Vec<CyclesTopUp>,
    #[serde(default)]
    frozen: Option<FrozenGroupInfo>,
}

impl PrivateGroupInfo {
    pub fn new(id: ChatId, now: TimestampMillis, wasm_version: Version, cycles: Cycles) -> PrivateGroupInfo {
        PrivateGroupInfo {
            id,
            created: now,
            marked_active_until: now + MARK_ACTIVE_DURATION,
            wasm_version,
            cycle_top_ups: vec![CyclesTopUp {
                date: now,
                amount: cycles,
            }],
            frozen: None,
        }
    }

    pub fn from(
        id: ChatId,
        created: TimestampMillis,
        marked_active_until: TimestampMillis,
        wasm_version: Version,
        cycle_top_ups: Vec<CyclesTopUp>,
    ) -> PrivateGroupInfo {
        PrivateGroupInfo {
            id,
            created,
            marked_active_until,
            wasm_version,
            cycle_top_ups,
            frozen: None,
        }
    }

    pub fn id(&self) -> ChatId {
        self.id
    }

    pub fn wasm_version(&self) -> Version {
        self.wasm_version
    }

    pub fn mark_active(&mut self, until: TimestampMillis) {
        self.marked_active_until = until;
    }

    pub fn has_been_active_since(&self, since: TimestampMillis) -> bool {
        self.marked_active_until > since
    }

    pub fn mark_cycles_top_up(&mut self, top_up: CyclesTopUp) {
        self.cycle_top_ups.push(top_up)
    }

    pub fn frozen(&self) -> bool {
        self.frozen.is_some()
    }

    pub fn set_frozen(&mut self, info: Option<FrozenGroupInfo>) {
        self.frozen = info;
    }
}
