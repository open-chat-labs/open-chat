use crate::model::cached_hot_groups::CachedPublicGroupSummary;
use crate::{CACHED_HOT_GROUPS_COUNT, MARK_ACTIVE_DURATION};
use candid::CandidType;
use search::*;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::{
    ChatId, Cycles, CyclesTopUp, GroupMatch, Milliseconds, PublicGroupActivity, PublicGroupSummary, TimestampMillis, Version,
};
use utils::iterator_extensions::IteratorExtensions;
use utils::time::DAY_IN_MS;

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

    pub fn calculate_hot_groups(&self, now: TimestampMillis) -> Vec<ChatId> {
        self.groups
            .values()
            .max_n_by(CACHED_HOT_GROUPS_COUNT, |g| g.calculate_weight(now))
            .map(|g| g.id)
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

    pub fn calculate_weight(&self, now: TimestampMillis) -> u64 {
        let mut weighting = 0u64;

        const MAX_RECENCY_MULTIPLIER: u64 = 1000;
        const ZERO_WEIGHT_AFTER_DURATION: Milliseconds = DAY_IN_MS;

        // recency_multiplier is MAX_RECENCY_MULTIPLIER for groups which are active now and is
        // linear down to 0 for groups which were active ZERO_WEIGHT_AFTER_DURATION ago. So for
        // example, recency_multiplier will be MAX_RECENCY_MULTIPLIER / 2 for a group that was
        // active ZERO_WEIGHT_AFTER_DURATION / 2 ago.
        let mut recency_multiplier = 0u64;
        if self.marked_active_until >= now {
            recency_multiplier = MAX_RECENCY_MULTIPLIER;
        } else if self.marked_active_until > now - ZERO_WEIGHT_AFTER_DURATION {
            recency_multiplier = MAX_RECENCY_MULTIPLIER
                .saturating_sub((MAX_RECENCY_MULTIPLIER * (now - self.marked_active_until)) / ZERO_WEIGHT_AFTER_DURATION);
        }

        if recency_multiplier > 0 {
            let activity = &self.activity.last_day;

            weighting += (activity.messages * activity.message_unique_users) as u64;
            weighting += (activity.reactions * activity.reaction_unique_users) as u64;

            weighting *= recency_multiplier
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
