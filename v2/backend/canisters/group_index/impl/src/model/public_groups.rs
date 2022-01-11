use crate::MARK_ACTIVE_DURATION;
use candid::CandidType;
use search::*;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::{ChatId, Cycles, CyclesTopUp, GroupMatch, PublicGroupActivity, TimestampMillis, Version};

#[derive(CandidType, Serialize, Deserialize, Default)]
pub struct PublicGroups {
    groups: HashMap<ChatId, PublicGroupInfo>,
    name_to_id_map: HashMap<String, ChatId>,
    groups_pending: HashMap<String, TimestampMillis>,
}

impl PublicGroups {
    pub fn len(&self) -> usize {
        self.groups.len()
    }

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

    pub fn handle_group_created(&mut self, args: GroupCreatedArgs) -> bool {
        if self.groups_pending.remove(&args.name).is_some() {
            let group_info = PublicGroupInfo::new(
                args.chat_id,
                args.name.clone(),
                args.description,
                args.avatar_id,
                args.now,
                args.wasm_version,
                args.cycles,
            );

            self.name_to_id_map.insert(args.name, args.chat_id);
            self.groups.insert(args.chat_id, group_info);
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

    pub fn delete(&mut self, chat_id: &ChatId) -> bool {
        if let Some(group) = self.groups.remove(chat_id) {
            self.name_to_id_map.remove(&group.name);
            true
        } else {
            false
        }
    }

    pub fn iter(&self) -> impl Iterator<Item = &PublicGroupInfo> {
        self.groups.values()
    }
}

#[derive(CandidType, Serialize, Deserialize)]
pub struct PublicGroupInfo {
    id: ChatId,
    name: String,
    description: String,
    avatar_id: Option<u128>,
    created: TimestampMillis,
    marked_active_until: TimestampMillis,
    #[serde(default)]
    activity: PublicGroupActivity,
    wasm_version: Version,
    cycle_top_ups: Vec<CyclesTopUp>,
    upgrade_in_progress: bool,
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
        cycles: Cycles,
    ) -> PublicGroupInfo {
        PublicGroupInfo {
            id,
            name,
            description,
            avatar_id,
            created: now,
            marked_active_until: now + MARK_ACTIVE_DURATION,
            activity: PublicGroupActivity::default(),
            wasm_version,
            cycle_top_ups: vec![CyclesTopUp {
                date: now,
                amount: cycles,
            }],
            upgrade_in_progress: false,
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

    pub fn mark_active(&mut self, until: TimestampMillis, activity: PublicGroupActivity) {
        self.marked_active_until = until;
        self.activity = activity;
    }

    pub fn has_been_active_since(&self, since: TimestampMillis) -> bool {
        self.marked_active_until > since
    }

    pub fn mark_cycles_top_up(&mut self, top_up: CyclesTopUp) {
        self.cycle_top_ups.push(top_up)
    }

    pub fn upgrade_in_progress(&self) -> bool {
        self.upgrade_in_progress
    }

    pub fn set_upgrade_in_progress(&mut self, upgrade_in_progress: bool) {
        self.upgrade_in_progress = upgrade_in_progress;
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

pub struct GroupCreatedArgs {
    pub chat_id: ChatId,
    pub name: String,
    pub description: String,
    pub avatar_id: Option<u128>,
    pub now: TimestampMillis,
    pub wasm_version: Version,
    pub cycles: Cycles,
}
