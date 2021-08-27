use candid::Principal;
use std::collections::hash_map::Entry::Vacant;
use std::collections::{HashMap, HashSet};
use types::{EventIndex, MessageIndex, ParticipantInternal, Role, TimestampMillis, Updatable, UserId};

#[derive(Default)]
pub struct Participants {
    by_principal: HashMap<Principal, ParticipantInternal>,
    user_id_to_principal_map: HashMap<UserId, Principal>,
    blocked: HashSet<UserId>,
}

impl Participants {
    pub fn new(creator_principal: Principal, creator_user_id: UserId, now: TimestampMillis) -> Participants {
        let participant = ParticipantInternal {
            user_id: creator_user_id,
            date_added: now,
            role: Role::Admin,
            read_up_to: Updatable::new(MessageIndex::default(), now),
            mute_notifications: false,
            min_visible_event_index: EventIndex::default(),
        };

        Participants {
            by_principal: vec![(creator_principal, participant)].into_iter().collect(),
            user_id_to_principal_map: vec![(creator_user_id, creator_principal)].into_iter().collect(),
            blocked: HashSet::new(),
        }
    }

    pub fn add(
        &mut self,
        user_id: UserId,
        principal: Principal,
        now: TimestampMillis,
        latest_message_index: MessageIndex,
        min_visible_event_index: EventIndex,
    ) -> AddResult {
        if self.blocked.contains(&user_id) {
            AddResult::Blocked
        } else {
            match self.by_principal.entry(principal) {
                Vacant(e) => {
                    e.insert(ParticipantInternal {
                        user_id,
                        date_added: now,
                        role: Role::Participant,
                        read_up_to: Updatable::new(latest_message_index, now),
                        mute_notifications: false,
                        min_visible_event_index,
                    });
                    self.user_id_to_principal_map.insert(user_id, principal);
                    AddResult::Success
                }
                _ => AddResult::AlreadyInGroup,
            }
        }
    }

    pub fn remove(&mut self, user_id: UserId) -> bool {
        match self.user_id_to_principal_map.remove(&user_id) {
            None => false,
            Some(principal) => {
                self.by_principal.remove(&principal);
                true
            }
        }
    }

    pub fn block(&mut self, user_id: UserId) {
        self.blocked.insert(user_id);
    }
    pub fn iter(&self) -> impl Iterator<Item = &ParticipantInternal> {
        self.by_principal.values()
    }

    pub fn get(&self, user_id_or_principal: Principal) -> Option<&ParticipantInternal> {
        let principal = self
            .user_id_to_principal_map
            .get(&user_id_or_principal.into())
            .unwrap_or(&user_id_or_principal);

        self.by_principal.get(principal)
    }

    pub fn get_by_user_id(&self, user_id: &UserId) -> Option<&ParticipantInternal> {
        if let Some(p) = self.user_id_to_principal_map.get(user_id) {
            self.get_by_principal(p)
        } else {
            None
        }
    }

    pub fn get_by_user_id_mut(&mut self, user_id: &UserId) -> Option<&mut ParticipantInternal> {
        if let Some(&p) = self.user_id_to_principal_map.get(user_id) {
            self.get_by_principal_mut(&p)
        } else {
            None
        }
    }

    pub fn get_by_principal(&self, principal: &Principal) -> Option<&ParticipantInternal> {
        self.by_principal.get(principal)
    }

    pub fn get_by_principal_mut(&mut self, principal: &Principal) -> Option<&mut ParticipantInternal> {
        self.by_principal.get_mut(principal)
    }

    pub fn is_blocked(&self, user_id: &UserId) -> bool {
        self.blocked.contains(user_id)
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
