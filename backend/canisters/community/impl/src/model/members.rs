use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Vacant;
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

    pub fn add(&mut self, user_id: UserId, principal: Principal, now: TimestampMillis, notifications_muted: bool) -> AddResult {
        if self.blocked.contains(&user_id) {
            AddResult::Blocked
        } else {
            match self.by_principal.entry(principal) {
                Vacant(e) => {
                    let participant = ParticipantInternal {
                        user_id,
                        date_added: now,
                        role: CommunityRole::Participant,
                        min_visible_event_index,
                        min_visible_message_index,
                        notifications_muted: Timestamped::new(notifications_muted, now),
                        mentions_v2: Mentions::default(),
                        threads: HashSet::new(),
                        proposal_votes: BTreeMap::default(),
                        suspended: Timestamped::default(),
                    };
                    e.insert(participant.clone());
                    self.user_id_to_principal_map.insert(user_id, principal);
                    AddResult::Success(participant)
                }
                _ => AddResult::AlreadyInGroup,
            }
        }
    }

    pub fn get_by_principal(&self, principal: &Principal) -> Option<&MemberInternal> {
        self.by_principal.get(principal)
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

#[allow(clippy::large_enum_variant)]
pub enum AddResult {
    Success(ParticipantInternal),
    AlreadyInGroup,
    Blocked,
}
