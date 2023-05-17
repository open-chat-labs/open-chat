use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Vacant;
use std::collections::{HashMap, HashSet};
use types::{CommunityGroupId, GroupRules, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct Groups {
    groups: HashMap<CommunityGroupId, Group>,
    default_groups: HashSet<CommunityGroupId>,
}

impl Groups {
    pub fn add(&mut self, group_id: CommunityGroupId, group: Group) {
        match self.groups.entry(group_id) {
            Vacant(e) => e.insert(group),
            _ => unreachable!(),
        };
    }
}

#[derive(Serialize, Deserialize)]
pub struct Group {
    pub is_public: bool,
    pub name: String,
    pub description: String,
    pub rules: GroupRules,
    pub history_visible_to_new_joiners: bool,
    pub created: TimestampMillis,
}

impl Group {
    pub fn new(
        is_public: bool,
        name: String,
        description: String,
        rules: GroupRules,
        history_visible_to_new_joiners: bool,
        now: TimestampMillis,
    ) -> Group {
        Group {
            is_public,
            name,
            description,
            rules,
            history_visible_to_new_joiners,
            created: now,
        }
    }
}
