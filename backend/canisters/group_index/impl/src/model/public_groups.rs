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
    ChatId, FrozenGroupInfo, GroupMatch, GroupSubtype, Milliseconds, PublicGroupActivity, PublicGroupSummary, TimestampMillis,
    Version,
};
use utils::case_insensitive_hash_map::CaseInsensitiveHashMap;
use utils::iterator_extensions::IteratorExtensions;
use utils::time::DAY_IN_MS;

use super::private_groups::PrivateGroupInfo;

#[derive(Serialize, Deserialize, Default)]
#[serde(from = "PublicGroupsTrimmed")]
pub struct PublicGroups {
    groups: HashMap<ChatId, PublicGroupInfo>,
    #[serde(skip)]
    name_to_id_map: CaseInsensitiveHashMap<ChatId>,
    groups_pending: CaseInsensitiveHashMap<TimestampMillis>,
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

    pub fn is_name_taken(&self, name: &str) -> bool {
        self.name_to_id_map.contains_key(name) || self.groups_pending.contains_key(name)
    }

    pub fn reserve_name(&mut self, name: &str, now: TimestampMillis) -> bool {
        if self.is_name_taken(name) {
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
            subtype,
            avatar_id,
            now,
        }: GroupCreatedArgs,
    ) -> bool {
        if self.groups_pending.remove(&name).is_some() {
            self.name_to_id_map.insert(&name, chat_id);
            let group_info = PublicGroupInfo::new(chat_id, name, description, subtype, avatar_id, now);
            self.groups.insert(chat_id, group_info);
            true
        } else {
            false
        }
    }

    pub fn handle_group_creation_failed(&mut self, name: &str) {
        self.groups_pending.remove(name);
    }

    pub fn search(&self, search_term: String, max_results: u8) -> Vec<GroupMatch> {
        let query = Query::parse(search_term);

        self.iter()
            .filter(|g| !g.is_frozen())
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
            subtype: group.subtype.clone(),
            history_visible_to_new_joiners: true,
            avatar_id: group.avatar_id,
            latest_message: summary.latest_message,
            latest_event_index: summary.latest_event_index,
            participant_count: summary.participant_count,
            is_public: true,
            frozen: None,
            events_ttl: summary.events_ttl,
            gate: summary.gate,
            wasm_version: Version::default(),
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

        self.iter()
            .filter(|g| !g.is_frozen() && g.has_been_active_since(one_day_ago) && !g.exclude_from_hotlist)
            .map(|g| (g, rng.next_u32()))
            .max_n_by(CACHED_HOT_GROUPS_COUNT, |(g, random)| g.calculate_weight(*random, now))
            .map(|(g, _)| g.id)
            .collect()
    }
}

#[derive(CandidType, Serialize, Deserialize)]
pub struct PublicGroupInfo {
    // Fields common to PrivateGroupInfo
    id: ChatId,
    created: TimestampMillis,
    marked_active_until: TimestampMillis,
    frozen: Option<FrozenGroupInfo>,

    // Fields particular to PublicGroupInfo
    name: String,
    description: String,
    subtype: Option<GroupSubtype>,
    avatar_id: Option<u128>,
    activity: PublicGroupActivity,
    exclude_from_hotlist: bool,
}

pub enum UpdateGroupResult {
    Success,
    ChatNotFound,
    NameTaken,
}

impl PublicGroupInfo {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        id: ChatId,
        name: String,
        description: String,
        subtype: Option<GroupSubtype>,
        avatar_id: Option<u128>,
        now: TimestampMillis,
    ) -> PublicGroupInfo {
        PublicGroupInfo {
            id,
            name,
            description,
            subtype,
            avatar_id,
            created: now,
            marked_active_until: now + MARK_ACTIVE_DURATION,
            activity: PublicGroupActivity::default(),
            frozen: None,
            exclude_from_hotlist: false,
        }
    }

    pub fn id(&self) -> ChatId {
        self.id
    }

    pub fn mark_active(&mut self, until: TimestampMillis, activity: PublicGroupActivity) {
        self.marked_active_until = until;
        self.activity = activity;
    }

    pub fn has_been_active_since(&self, since: TimestampMillis) -> bool {
        self.marked_active_until > since
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

    pub fn is_frozen(&self) -> bool {
        self.frozen.is_some()
    }

    pub fn frozen_info(&self) -> Option<&FrozenGroupInfo> {
        self.frozen.as_ref()
    }

    pub fn set_frozen(&mut self, info: Option<FrozenGroupInfo>) {
        self.frozen = info;
    }

    pub fn is_excluded_from_hotlist(&self) -> bool {
        self.exclude_from_hotlist
    }

    pub fn set_excluded_from_hotlist(&mut self, exclude: bool) {
        self.exclude_from_hotlist = exclude;
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
            .add_field(group.name.to_string(), 5.0, true)
            .add_field(group.description.to_string(), 1.0, true);
        document
    }
}

impl From<PublicGroupInfo> for PrivateGroupInfo {
    fn from(public_group_info: PublicGroupInfo) -> Self {
        let mut private_group_info = PrivateGroupInfo::new(public_group_info.id, public_group_info.created);
        private_group_info.mark_active(public_group_info.marked_active_until);
        private_group_info.set_frozen(public_group_info.frozen);
        private_group_info
    }
}

pub struct GroupCreatedArgs {
    pub chat_id: ChatId,
    pub name: String,
    pub description: String,
    pub subtype: Option<GroupSubtype>,
    pub avatar_id: Option<u128>,
    pub now: TimestampMillis,
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

#[derive(Deserialize)]
struct PublicGroupsTrimmed {
    groups: HashMap<ChatId, PublicGroupInfo>,
    groups_pending: CaseInsensitiveHashMap<TimestampMillis>,
}

impl From<PublicGroupsTrimmed> for PublicGroups {
    fn from(value: PublicGroupsTrimmed) -> Self {
        let mut public_groups = PublicGroups {
            groups: value.groups,
            groups_pending: value.groups_pending,
            ..Default::default()
        };

        for (chat_id, group) in public_groups.groups.iter() {
            public_groups.name_to_id_map.insert(&group.name, *chat_id);
        }

        public_groups
    }
}
