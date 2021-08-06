use candid::Principal;
use group_canister::common::participant::Participant;
use group_canister::common::role::Role;
use shared::time::TimestampMillis;
use shared::types::{MessageIndex, UserId};
use std::collections::hash_map::Entry::Vacant;
use std::collections::{HashMap, HashSet};

#[derive(Default)]
pub struct Participants {
    by_principal: HashMap<Principal, Participant>,
    blocked: HashSet<UserId>,
}

impl Participants {
    pub fn new(creator_principal: Principal, creator_user_id: UserId, now: TimestampMillis) -> Participants {
        let participant = Participant {
            user_id: creator_user_id,
            date_added: now,
            role: Role::Admin,
            read_up_to: MessageIndex::default(),
            mute_notifications: false,
        };

        Participants {
            by_principal: vec![(creator_principal, participant)].into_iter().collect(),
            blocked: HashSet::new(),
        }
    }

    pub fn add(
        &mut self,
        principal: Principal,
        user_id: UserId,
        now: TimestampMillis,
        latest_message_index: MessageIndex,
    ) -> AddResult {
        if self.blocked.contains(&user_id) {
            AddResult::Blocked
        } else {
            match self.by_principal.entry(principal) {
                Vacant(e) => {
                    e.insert(Participant {
                        user_id,
                        date_added: now,
                        role: Role::Participant,
                        read_up_to: latest_message_index,
                        mute_notifications: false,
                    });
                    AddResult::Success
                }
                _ => AddResult::AlreadyInGroup,
            }
        }
    }

    pub fn get_by_principal(&self, principal: &Principal) -> Option<&Participant> {
        self.by_principal.get(principal)
    }

    pub fn get_by_principal_mut(&mut self, principal: &Principal) -> Option<&mut Participant> {
        self.by_principal.get_mut(principal)
    }

    pub fn get_other_user_ids(&self, my_user_id: UserId) -> Vec<UserId> {
        self.by_principal
            .values()
            .filter(|p| p.user_id != my_user_id)
            .map(|p| p.user_id)
            .collect()
    }
}

pub enum AddResult {
    Success,
    AlreadyInGroup,
    Blocked,
}
