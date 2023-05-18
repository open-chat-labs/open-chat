use chat_events::ChatEvents;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Vacant;
use std::collections::{HashMap, HashSet};
use types::{CommunityGroupId, GroupGate, GroupRules, Milliseconds, TimestampMillis, UserId};

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

    pub fn get_mut(&mut self, group_id: &CommunityGroupId) -> Option<&mut Group> {
        self.groups.get_mut(group_id)
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
    pub events: ChatEvents,
    pub gate: Option<GroupGate>,
}

impl Group {
    pub fn new(
        created_by: UserId,
        is_public: bool,
        name: String,
        description: String,
        rules: GroupRules,
        history_visible_to_new_joiners: bool,
        events_ttl: Option<Milliseconds>,
        gate: Option<GroupGate>,
        now: TimestampMillis,
    ) -> Group {
        let events = ChatEvents::new_group_chat(name.clone(), description.clone(), created_by, events_ttl, now);

        Group {
            is_public,
            name,
            description,
            rules,
            history_visible_to_new_joiners,
            created: now,
            events,
            gate,
        }
    }
}
