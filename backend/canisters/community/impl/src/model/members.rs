use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Vacant;
use std::collections::{HashMap, HashSet};
use types::{CommunityRole, TimestampMillis, Timestamped, UserId};

#[derive(Serialize, Deserialize)]
pub struct CommunityMembers {
    by_principal: HashMap<Principal, CommunityMembersInternal>,
    user_id_to_principal_map: HashMap<UserId, Principal>,
    blocked: HashSet<UserId>,
    admin_count: u32,
    owner_count: u32,
}

impl CommunityMembers {
    pub fn new(creator_principal: Principal, creator_user_id: UserId, now: TimestampMillis) -> CommunityMembers {
        let member = CommunityMembersInternal {
            user_id: creator_user_id,
            date_added: now,
            role: CommunityRole::Owner,
            notifications_muted: Timestamped::new(false, now),
            suspended: Timestamped::default(),
        };

        CommunityMembers {
            by_principal: vec![(creator_principal, member)].into_iter().collect(),
            user_id_to_principal_map: vec![(creator_user_id, creator_principal)].into_iter().collect(),
            blocked: HashSet::new(),
            admin_count: 0,
            owner_count: 1,
        }
    }

    pub fn add(&mut self, user_id: UserId, principal: Principal, now: TimestampMillis, notifications_muted: bool) -> AddResult {
        if self.blocked.contains(&user_id) {
            AddResult::Blocked
        } else {
            match self.by_principal.entry(principal) {
                Vacant(e) => {
                    let member = CommunityMembersInternal {
                        user_id,
                        date_added: now,
                        role: CommunityRole::Member,
                        notifications_muted: Timestamped::new(notifications_muted, now),
                        suspended: Timestamped::default(),
                    };
                    e.insert(member.clone());
                    self.user_id_to_principal_map.insert(user_id, principal);
                    AddResult::Success(member)
                }
                _ => AddResult::AlreadyInGroup,
            }
        }
    }

    pub fn get_by_principal(&self, principal: &Principal) -> Option<&CommunityMembersInternal> {
        self.by_principal.get(principal)
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CommunityMembersInternal {
    pub user_id: UserId,
    pub date_added: TimestampMillis,
    pub role: CommunityRole,
    pub notifications_muted: Timestamped<bool>,
    pub suspended: Timestamped<bool>,
}

#[allow(clippy::large_enum_variant)]
pub enum AddResult {
    Success(CommunityMembersInternal),
    AlreadyInGroup,
    Blocked,
}
