use crate::model::cached_hot_groups::CachedPublicGroupSummary;
use crate::{CACHED_HOT_GROUPS_COUNT, MARK_ACTIVE_DURATION};
use candid::CandidType;
use rand::rngs::StdRng;
use rand::{RngCore, SeedableRng};
use search::*;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::HashMap;
use types::{
    ChatId, Cycles, CyclesTopUp, GroupMatch, Milliseconds, PublicGroupActivity, PublicGroupSummary, TimestampMillis, Version,
};
use utils::case_insensitive_hash_map::CaseInsensitiveHashMap;
use utils::iterator_extensions::IteratorExtensions;
use utils::time::DAY_IN_MS;

use super::private_groups::PrivateGroupInfo;

#[derive(CandidType, Serialize, Deserialize, Default)]
pub struct PublicGroups {
    groups: HashMap<ChatId, PublicGroupInfo>,
    #[serde(skip)]
    name_to_id_map: CaseInsensitiveHashMap<ChatId>,
    groups_pending: CaseInsensitiveHashMap<TimestampMillis>,
}

impl PublicGroups {
    pub fn hydrate(&mut self) {
        for (chat_id, group) in self.groups.iter() {
            self.name_to_id_map.insert(&group.name, *chat_id);
        }
    }

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
            self.groups_pending.insert(name, now);
            true
        }
    }

    pub fn handle_group_created(
        &mut self,
        GroupCreatedArgs {
            chat_id,
            name,
            description,
            avatar_id,
            now,
            wasm_version,
            cycles,
        }: GroupCreatedArgs,
    ) -> bool {
        if self.groups_pending.remove(&name).is_some() {
            self.name_to_id_map.insert(&name, chat_id);
            let group_info = PublicGroupInfo::new(chat_id, name, description, avatar_id, now, wasm_version, cycles);
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

        self.groups
            .values()
            .map(|g| {
                let document: Document = g.into();
                let score = document.calculate_score(&query);
                (score, g)
            })
            .filter(|(score, _)| *score > 0)
            .max_n_by(max_results as usize, |(score, _)| *score)
            .map(|(_, g)| g.into())
            .collect()
    }

    pub fn hydrate_cached_summary(&self, summary: CachedPublicGroupSummary) -> Option<PublicGroupSummary> {
        self.groups.get(&summary.chat_id).map(|group| PublicGroupSummary {
            chat_id: summary.chat_id,
            last_updated: summary.last_updated,
            name: group.name.clone(),
            description: group.description.clone(),
            avatar_id: group.avatar_id,
            latest_message: summary.latest_message,
            latest_event_index: summary.latest_event_index,
            participant_count: summary.participant_count,
            pinned_message: summary.pinned_message,
            wasm_version: group.wasm_version,
            owner_id: summary.owner_id,
            is_public: true,
        })
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
                if group.name != name {
                    if self.name_to_id_map.contains_key(&name) || self.groups_pending.contains_key(&name) {
                        return UpdateGroupResult::NameTaken;
                    }
                    self.name_to_id_map.remove(&group.name);
                    self.name_to_id_map.insert(&name, *chat_id);
                }

                group.name = name;
                group.description = description;
                group.avatar_id = avatar_id;
                UpdateGroupResult::Success
            }
        }
    }

    pub fn delete(&mut self, chat_id: &ChatId) -> Option<PublicGroupInfo> {
        if let Some(group) = self.groups.remove(chat_id) {
            self.name_to_id_map.remove(&group.name);
            Some(group)
        } else {
            None
        }
    }

    pub fn iter(&self) -> impl Iterator<Item = &PublicGroupInfo> {
        self.groups.values()
    }

    pub fn calculate_hot_groups(&self, now: TimestampMillis) -> Vec<ChatId> {
        let mut rng = StdRng::seed_from_u64(now);
        let one_day_ago = now - DAY_IN_MS;

        self.groups
            .values()
            .filter(|g| g.has_been_active_since(one_day_ago))
            .map(|g| (g, rng.next_u32()))
            .max_n_by(CACHED_HOT_GROUPS_COUNT, |(g, random)| g.calculate_weight(*random, now))
            .map(|(g, _)| g.id)
            .collect()
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

    pub fn calculate_weight(&self, random: u32, now: TimestampMillis) -> u64 {
        let mut weighting = 0u64;

        const MAX_RECENCY_MULTIPLIER: u64 = 1000;
        const ZERO_WEIGHT_AFTER_DURATION: Milliseconds = DAY_IN_MS;

        // recency_multiplier is MAX_RECENCY_MULTIPLIER for groups which are active now and is
        // linear down to 0 for groups which were active ZERO_WEIGHT_AFTER_DURATION ago. So for
        // example, recency_multiplier will be MAX_RECENCY_MULTIPLIER / 2 for a group that was
        // active ZERO_WEIGHT_AFTER_DURATION / 2 ago.
        let mut recency_multiplier = MAX_RECENCY_MULTIPLIER;
        if self.marked_active_until < now {
            recency_multiplier = recency_multiplier
                .saturating_sub((MAX_RECENCY_MULTIPLIER * (now - self.marked_active_until)) / ZERO_WEIGHT_AFTER_DURATION);
        }

        if recency_multiplier > 0 {
            let activity = &self.activity.last_day;

            weighting += (activity.messages * activity.message_unique_users) as u64;
            weighting += (activity.reactions * activity.reaction_unique_users) as u64;

            weighting *= recency_multiplier;

            let random_multiplier = (random % 16) as u64;
            weighting *= random_multiplier;
        }
        weighting
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

impl From<PublicGroupInfo> for PrivateGroupInfo {
    fn from(public_group_info: PublicGroupInfo) -> Self {
        PrivateGroupInfo::from(
            public_group_info.id,
            public_group_info.created,
            public_group_info.marked_active_until,
            public_group_info.wasm_version,
            public_group_info.cycle_top_ups,
            public_group_info.upgrade_in_progress,
        )
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

#[derive(PartialEq, Eq, Debug)]
struct WeightedGroup {
    chat_id: ChatId,
    weighting: u64,
}

impl PartialOrd for WeightedGroup {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for WeightedGroup {
    fn cmp(&self, other: &Self) -> Ordering {
        self.weighting.cmp(&other.weighting)
    }
}
