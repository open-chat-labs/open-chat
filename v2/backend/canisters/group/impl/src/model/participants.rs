use candid::Principal;
use group_canister::common::participant::Participant;
use group_canister::common::role::Role;
use shared::time::TimestampMillis;
use shared::types::{MessageIndex, UserId};
use std::collections::hash_map::Entry::Vacant;
use std::collections::{HashMap, HashSet};

#[derive(Default)]
pub struct Participants {
    participants: HashMap<UserId, Participant>,
    principal_to_user_id_map: HashMap<Principal, UserId>,
    blocked: HashSet<UserId>,
}

impl Participants {
    pub fn new(creator_principal: Principal, creator_user_id: UserId, now: TimestampMillis) -> Participants {
        let participant = Participant {
            user_id: creator_user_id,
            principal: creator_principal,
            date_added: now,
            role: Role::Admin,
            read_up_to: MessageIndex::default(),
            mute_notifications: false,
        };

        Participants {
            participants: vec![(creator_user_id, participant)].into_iter().collect(),
            principal_to_user_id_map: vec![(creator_principal, creator_user_id)].into_iter().collect(),
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
            match self.participants.entry(user_id) {
                Vacant(e) => {
                    e.insert(Participant {
                        user_id,
                        principal,
                        date_added: now,
                        role: Role::Participant,
                        read_up_to: latest_message_index,
                        mute_notifications: false,
                    });
                    self.principal_to_user_id_map.insert(principal, user_id);
                    AddResult::Success
                }
                _ => AddResult::AlreadyInGroup,
            }
        }
    }

    pub fn remove_unchecked(&mut self, user_id: &UserId) -> bool {
        if let Some(participant) = self.participants.remove(user_id) {
            self.principal_to_user_id_map.remove(&participant.principal);
            true
        } else {
            false
        }
    }

    pub fn get(&self, user_id: &UserId) -> Option<&Participant> {
        self.participants.get(user_id)
    }

    pub fn get_mut(&mut self, user_id: &UserId) -> Option<&mut Participant> {
        self.participants.get_mut(user_id)
    }

    pub fn get_by_principal(&self, principal: &Principal) -> Option<&Participant> {
        if let Some(u) = self.principal_to_user_id_map.get(principal) {
            self.get(u)
        } else {
            None
        }
    }

    pub fn get_by_principal_mut(&mut self, principal: &Principal) -> Option<&mut Participant> {
        if let Some(&u) = self.principal_to_user_id_map.get(principal) {
            self.get_mut(&u)
        } else {
            None
        }
    }

    pub fn is_blocked(&self, user_id: &UserId) -> bool {
        self.blocked.contains(user_id)
    }

    pub fn get_other_user_ids(&self, my_user_id: UserId) -> Vec<UserId> {
        self.participants
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
