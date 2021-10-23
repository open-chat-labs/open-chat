use candid::{CandidType, Principal};
use serde::Deserialize;
use std::collections::hash_map::Entry::Vacant;
use std::collections::{HashMap, HashSet};
use types::{EventIndex, MessageIndex, Participant, Role, TimestampMillis, UserId};

const MAX_PARTICIPANTS_PER_PUBLIC_GROUP: u32 = 100_000;
const MAX_PARTICIPANTS_PER_PRIVATE_GROUP: u32 = 200;

#[derive(CandidType, Deserialize, Default)]
pub struct Participants {
    by_principal: HashMap<Principal, ParticipantInternal>,
    user_id_to_principal_map: HashMap<UserId, Principal>,
    blocked: HashSet<UserId>,
    admin_count: u32,
}

impl Participants {
    pub fn new(creator_principal: Principal, creator_user_id: UserId, now: TimestampMillis) -> Participants {
        let participant = ParticipantInternal {
            user_id: creator_user_id,
            date_added: now,
            role: Role::Admin,
            min_visible_event_index: EventIndex::default(),
            min_visible_message_index: MessageIndex::default(),
            notifications_muted: false,
        };

        Participants {
            by_principal: vec![(creator_principal, participant)].into_iter().collect(),
            user_id_to_principal_map: vec![(creator_user_id, creator_principal)].into_iter().collect(),
            blocked: HashSet::new(),
            admin_count: 1,
        }
    }

    pub fn add(
        &mut self,
        user_id: UserId,
        principal: Principal,
        now: TimestampMillis,
        min_visible_event_index: EventIndex,
        min_visible_message_index: MessageIndex,
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
                        min_visible_event_index,
                        min_visible_message_index,
                        notifications_muted: false,
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
                if let Some(participant) = self.by_principal.remove(&principal) {
                    if participant.role.is_admin() {
                        self.admin_count -= 1;
                    }
                }
                true
            }
        }
    }

    pub fn block(&mut self, user_id: UserId) {
        self.blocked.insert(user_id);
    }

    pub fn unblock(&mut self, user_id: &UserId) {
        self.blocked.remove(user_id);
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

    pub fn users_to_notify(&self, my_user_id: UserId) -> Vec<UserId> {
        self.by_principal
            .values()
            .filter(|p| p.user_id != my_user_id && !p.notifications_muted)
            .map(|p| p.user_id)
            .collect()
    }

    pub fn user_limit_reached(&self, is_public: bool) -> Option<u32> {
        let user_limit = if is_public { MAX_PARTICIPANTS_PER_PUBLIC_GROUP } else { MAX_PARTICIPANTS_PER_PRIVATE_GROUP };

        if self.by_principal.len() >= user_limit as usize {
            Some(user_limit)
        } else {
            None
        }
    }

    pub fn len(&self) -> u32 {
        self.user_id_to_principal_map.len() as u32
    }

    pub fn make_admin(&mut self, user_id: &UserId) -> MakeAdminResult {
        match self.get_by_user_id_mut(user_id) {
            Some(p) => {
                if matches!(p.role, Role::Admin) {
                    MakeAdminResult::AlreadyAdmin
                } else {
                    p.role = Role::Admin;
                    self.admin_count += 1;
                    MakeAdminResult::Success
                }
            }
            None => MakeAdminResult::NotInGroup,
        }
    }

    pub fn remove_admin(&mut self, user_id: &UserId) -> RemoveAdminResult {
        match self.get_by_user_id_mut(user_id) {
            Some(p) => {
                if matches!(p.role, Role::Admin) {
                    p.role = Role::Participant;
                    self.admin_count -= 1;
                    RemoveAdminResult::Success
                } else {
                    RemoveAdminResult::NotAdmin
                }
            }
            None => RemoveAdminResult::NotInGroup,
        }
    }

    pub fn admin_count(&self) -> u32 {
        self.admin_count
    }
}

pub enum AddResult {
    Success,
    AlreadyInGroup,
    Blocked,
}

pub enum MakeAdminResult {
    Success,
    NotInGroup,
    AlreadyAdmin,
}

pub enum RemoveAdminResult {
    Success,
    NotInGroup,
    NotAdmin,
}

#[derive(CandidType, Deserialize)]
pub struct ParticipantInternal {
    pub user_id: UserId,
    pub date_added: TimestampMillis,
    pub role: Role,
    pub min_visible_event_index: EventIndex,
    pub min_visible_message_index: MessageIndex,
    pub notifications_muted: bool,
}

impl From<ParticipantInternal> for Participant {
    fn from(p: ParticipantInternal) -> Self {
        Participant {
            user_id: p.user_id,
            date_added: p.date_added,
            role: p.role,
        }
    }
}

impl From<&ParticipantInternal> for Participant {
    fn from(p: &ParticipantInternal) -> Self {
        Participant {
            user_id: p.user_id,
            date_added: p.date_added,
            role: p.role,
        }
    }
}
