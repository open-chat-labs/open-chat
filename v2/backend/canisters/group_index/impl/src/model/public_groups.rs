use crate::MARK_ACTIVE_DURATION;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::{ChatId, GroupMatch, TimestampMillis, Version};

#[derive(Default)]
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

    pub fn reserve_name(&mut self, name: String, now: TimestampMillis) -> bool {
        if self.name_to_id_map.contains_key(&name) {
            false
        } else {
            match self.groups_pending.entry(name) {
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
        now: TimestampMillis,
        wasm_version: Version,
    ) -> bool {
        if self.groups_pending.remove(&name).is_some() {
            let group_info = PublicGroupInfo::new(chat_id, name.clone(), description, now, wasm_version);

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
        let search_term_lower = search_term.to_lowercase();

        let mut all_matches = self
            .groups
            .values()
            .map(|g| (g.score_match(search_term, &search_term_lower), g))
            .filter(|m| m.0 > 0)
            .collect::<Vec<_>>();

        all_matches.sort_unstable_by(|m1, m2| m2.0.cmp(&m1.0));

        all_matches.iter().take(max_results as usize).map(|m| m.1.into()).collect()
    }
}

#[allow(dead_code)]
#[derive(Debug)]
pub struct PublicGroupInfo {
    id: ChatId,
    name: String,
    description: String,
    created: TimestampMillis,
    marked_active_until: TimestampMillis,
    wasm_version: Version,
}

impl PublicGroupInfo {
    pub fn new(id: ChatId, name: String, description: String, now: TimestampMillis, wasm_version: Version) -> PublicGroupInfo {
        PublicGroupInfo {
            id,
            name,
            description,
            created: now,
            marked_active_until: now + MARK_ACTIVE_DURATION,
            wasm_version,
        }
    }

    pub fn id(&self) -> ChatId {
        self.id
    }

    pub fn mark_active(&mut self, until: TimestampMillis) {
        self.marked_active_until = until;
    }

    pub fn is_active(&self, now: TimestampMillis) -> bool {
        self.marked_active_until > now
    }

    // To match, the name or description must contain the case-insensitive search_term.
    // Extra weight is given:
    // 1. for matching both fields, then name, then description
    // 2. for case-sensitive matches
    // 3. the shorter the matching field(s)
    // 4. if the term matches the start of the field
    // A score of zero means no match
    pub fn score_match(&self, search_term: &str, search_term_lower: &str) -> u32 {
        fn score_field(field: &str, search_term: &str, search_term_lower: &str) -> f32 {
            fn calculate_base_score(field: &str, search_term: &str, search_term_lower: &str) -> f32 {
                let field_lower = field.to_lowercase();
                if field.starts_with(search_term) {
                    5.0
                } else if field_lower.starts_with(search_term_lower) {
                    3.0
                } else if field.contains(search_term) {
                    2.0
                } else if field_lower.contains(search_term_lower) {
                    1.0
                } else {
                    0.0
                }
            }

            // b is boost, p is proportion of field length to term length
            // 3b = 7 - p (1 <= p <= 4)
            // b = 1 (p > 4)
            fn calculate_length_boost(p: f32) -> f32 {
                if p < 1.0 {
                    0.0
                } else if p >= 4.0 {
                    1.0
                } else {
                    (7.0 - p) / 3.0
                }
            }

            // If length of field is equal to length of term then boost score by 2 declining to 1 for a long field
            let score = calculate_base_score(field, search_term, search_term_lower);
            if score > 0.0 {
                let p = field.len() as f32 / search_term.len() as f32;
                let boost = calculate_length_boost(p);
                score * boost
            } else {
                0.0
            }
        }

        let name_score = score_field(&self.name, search_term, search_term_lower);
        let description_score = score_field(&self.description, search_term, search_term_lower);

        ((5.0 * name_score + description_score) * 1000.0) as u32
    }
}

impl From<&PublicGroupInfo> for GroupMatch {
    fn from(group: &PublicGroupInfo) -> Self {
        GroupMatch {
            chat_id: group.id,
            name: group.name.clone(),
            description: group.description.clone(),
        }
    }
}
