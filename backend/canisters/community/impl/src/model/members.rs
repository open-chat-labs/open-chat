use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use types::{CommunityRole, TimestampMillis, Timestamped, UserId};

#[derive(Serialize, Deserialize)]
pub struct Members {
    by_principal: HashMap<Principal, MemberInternal>,
    user_id_to_principal_map: HashMap<UserId, Principal>,
    blocked: HashSet<UserId>,
    moderator_count: u32,
    admin_count: u32,
    owner_count: u32,
}

impl Members {
    pub fn new(creator_principal: Principal, creator_user_id: UserId, now: TimestampMillis) -> Members {
        let member = MemberInternal {
            user_id: creator_user_id,
            date_added: now,
            role: CommunityRole::Owner,
            notifications_muted: Timestamped::new(false, now),
            suspended: Timestamped::default(),
        };

        Members {
            by_principal: vec![(creator_principal, member)].into_iter().collect(),
            user_id_to_principal_map: vec![(creator_user_id, creator_principal)].into_iter().collect(),
            blocked: HashSet::new(),
            moderator_count: 0,
            admin_count: 0,
            owner_count: 1,
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct MemberInternal {
    pub user_id: UserId,
    pub date_added: TimestampMillis,
    pub role: CommunityRole,
    pub notifications_muted: Timestamped<bool>,
    pub suspended: Timestamped<bool>,
}
