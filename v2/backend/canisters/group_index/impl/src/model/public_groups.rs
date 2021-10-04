use crate::MARK_ACTIVE_DURATION;
use candid::CandidType;
use search::*;
use serde::Deserialize;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::{ChatId, CyclesTopUp, GroupMatch, TimestampMillis, Version};

#[derive(CandidType, Deserialize, Default)]
pub struct PublicGroups {
    groups: HashMap<ChatId, PublicGroupInfo>,
    name_to_id_map: HashMap<String, ChatId>,
    groups_pending: HashMap<String, TimestampMillis>,
}

impl PublicGroups {
    pub fn get(&self, chat_id: &ChatId) -> Option<&PublicGroupInfo> {
        self.groups.get(chat_id)
    }

    pub fn get_mut(&mut self, chat_id: &ChatId) -> Option<&mut PublicGroupInfo> {
        self.groups.get_mut(chat_id)
    }

    pub fn reserve_name(&mut self, name: &str, now: TimestampMillis) -> bool {
        if self.name_to_id_map.contains_key(name) || self.groups_pending.contains_key(name) {
            false
        } else {
            match self.groups_pending.entry(name.to_owned()) {
                Occupied(_) => false,
                Vacant(e) => {
                    e.insert(now);
                    true
                }
            }
        }
    }

    pub fn handle_group_created(
        &mut self,
        chat_id: ChatId,
        name: String,
        description: String,
        avatar_id: Option<u128>,
        now: TimestampMillis,
        wasm_version: Version,
    ) -> bool {
        if self.groups_pending.remove(&name).is_some() {
            let group_info = PublicGroupInfo::new(chat_id, name.clone(), description, avatar_id, now, wasm_version);

            self.name_to_id_map.insert(name, chat_id);
            self.groups.insert(chat_id, group_info);
            true
        } else {
            false
        }
    }

    pub fn handle_group_creation_failed(&mut self, name: &str) {
        self.groups_pending.remove(name);
    }

    pub fn search(&self, search_term: &str, max_results: u8) -> Vec<GroupMatch> {
        let query = Query::parse(search_term);

        let mut all_matches = self
            .groups
            .values()
            .map(|g| {
                let document: Document = g.into();
                let score = document.calculate_score(&query);
                (score, g)
            })
            .filter(|m| m.0 > 0)
            .collect::<Vec<_>>();

        all_matches.sort_unstable_by(|m1, m2| m2.0.cmp(&m1.0));

        all_matches.iter().take(max_results as usize).map(|m| m.1.into()).collect()
    }

    pub fn update_group(
        &mut self,
        chat_id: &ChatId,
        name: String,
        description: String,
        avatar_id: Option<u128>,
    ) -> UpdateGroupResult {
        match self.groups.get_mut(chat_id) {
            None => UpdateGroupResult::ChatNotFound,
            Some(mut group) => {
                if group.name != name && (self.name_to_id_map.contains_key(&name) || self.groups_pending.contains_key(&name)) {
                    UpdateGroupResult::NameTaken
                } else {
                    self.name_to_id_map.remove(&group.name);
                    group.name = name;
                    group.description = description;
                    group.avatar_id = avatar_id;
                    UpdateGroupResult::Success
                }
            }
        }
    }

    pub fn iter(&self) -> impl Iterator<Item = &PublicGroupInfo> {
        self.groups.values()
    }
}

#[derive(CandidType, Deserialize)]
pub struct PublicGroupInfo {
    id: ChatId,
    name: String,
    description: String,
    avatar_id: Option<u128>,
    created: TimestampMillis,
    marked_active_until: TimestampMillis,
    wasm_version: Version,
    cycle_top_ups: Vec<CyclesTopUp>,
}

pub enum UpdateGroupResult {
    Success,
    ChatNotFound,
    NameTaken,
}

impl PublicGroupInfo {
    pub fn new(
        id: ChatId,
        name: String,
        description: String,
        avatar_id: Option<u128>,
        now: TimestampMillis,
        wasm_version: Version,
    ) -> PublicGroupInfo {
        PublicGroupInfo {
            id,
            name,
            description,
            avatar_id,
            created: now,
            marked_active_until: now + MARK_ACTIVE_DURATION,
            wasm_version,
            cycle_top_ups: Vec::new(),
        }
    }

    pub fn id(&self) -> ChatId {
        self.id
    }

    pub fn wasm_version(&self) -> Version {
        self.wasm_version
    }

    pub fn set_wasm_version(&mut self, version: Version) {
        self.wasm_version = version;
    }

    pub fn mark_active(&mut self, until: TimestampMillis) {
        self.marked_active_until = until;
    }

    pub fn is_active(&self, now: TimestampMillis) -> bool {
        self.marked_active_until > now
    }

    pub fn mark_cycles_top_up(&mut self, top_up: CyclesTopUp) {
        self.cycle_top_ups.push(top_up)
    }
}

impl From<&PublicGroupInfo> for GroupMatch {
    fn from(group: &PublicGroupInfo) -> Self {
        GroupMatch {
            chat_id: group.id,
            name: group.name.clone(),
            description: group.description.clone(),
            avatar_id: group.avatar_id,
        }
    }
}

impl From<&PublicGroupInfo> for Document {
    fn from(group: &PublicGroupInfo) -> Self {
        let mut document = Document::default();
        document
            .add_field(group.name.to_owned(), 5.0)
            .add_field(group.description.to_owned(), 1.0);
        document
    }
}
