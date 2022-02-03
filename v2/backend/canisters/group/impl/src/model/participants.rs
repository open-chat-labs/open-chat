use candid::{CandidType, Principal};
use chat_events::GroupChatEvents;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Vacant;
use std::collections::{HashMap, HashSet};
use types::{
    EventIndex, FallbackRole, Mention, MessageIndex, Participant, Role, TimestampMillis, UserId, MAX_RETURNED_MENTIONS,
};

const MAX_PARTICIPANTS_PER_PUBLIC_GROUP: u32 = 100_000;
const MAX_PARTICIPANTS_PER_PRIVATE_GROUP: u32 = 200;

#[derive(CandidType, Serialize, Deserialize, Default)]
pub struct Participants {
    by_principal: HashMap<Principal, ParticipantInternal>,
    user_id_to_principal_map: HashMap<UserId, Principal>,
    blocked: HashSet<UserId>,
    admin_count: u32,
    viewer_count: u32,
}

impl Participants {
    pub fn new(creator_principal: Principal, creator_user_id: UserId, now: TimestampMillis) -> Participants {
        let participant = ParticipantInternal {
            user_id: creator_user_id,
            date_added: now,
            role: Role::Owner,
            min_visible_event_index: EventIndex::default(),
            min_visible_message_index: MessageIndex::default(),
            notifications_muted: false,
            mentions: Vec::new(),
        };

        Participants {
            by_principal: vec![(creator_principal, participant)].into_iter().collect(),
            user_id_to_principal_map: vec![(creator_user_id, creator_principal)].into_iter().collect(),
            blocked: HashSet::new(),
            admin_count: 0,
            viewer_count: 0,
        }
    }

    pub fn add(
        &mut self,
        user_id: UserId,
        principal: Principal,
        now: TimestampMillis,
        min_visible_event_index: EventIndex,
        min_visible_message_index: MessageIndex,
        as_super_admin: bool,
        as_viewer: bool,
    ) -> AddResult {
        if self.blocked.contains(&user_id) {
            AddResult::Blocked
        } else {
            match self.by_principal.entry(principal) {
                Vacant(e) => {
                    let participant = ParticipantInternal {
                        user_id,
                        date_added: now,
                        role: if as_super_admin {
                            Role::SuperAdmin(FallbackRole::Participant)
                        } else if as_viewer {
                            Role::Viewer
                        } else {
                            Role::Participant
                        },
                        min_visible_event_index,
                        min_visible_message_index,
                        notifications_muted: false,
                        mentions: Vec::new(),
                    };
                    e.insert(participant.clone());
                    self.user_id_to_principal_map.insert(user_id, principal);
                    if as_viewer {
                        self.viewer_count += 1;
                    }
                    AddResult::Success(participant)
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
                    } else if participant.role.is_viewer() {
                        self.viewer_count -= 1;
                    }
                }
                true
            }
        }
    }

    pub fn block(&mut self, user_id: UserId) {
        self.blocked.insert(user_id);
    }

    pub fn unblock(&mut self, user_id: &UserId) -> bool {
        self.blocked.remove(user_id)
    }

    pub fn blocked(&self) -> Vec<UserId> {
        self.blocked.iter().copied().collect()
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

    pub fn users_to_notify(&self, my_user_id: UserId) -> HashSet<UserId> {
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
            Some(p) => match p.role {
                Role::Owner => return MakeAdminResult::AlreadyOwner,
                Role::Admin | Role::SuperAdmin(FallbackRole::Admin) => return MakeAdminResult::AlreadyAdmin,
                Role::Participant | Role::Viewer => p.role = Role::Admin,
                Role::SuperAdmin(FallbackRole::Participant) => p.role = Role::SuperAdmin(FallbackRole::Admin),
            },
            None => return MakeAdminResult::NotInGroup,
        }

        self.admin_count += 1;
        MakeAdminResult::Success
    }

    pub fn make_super_admin(&mut self, user_id: &UserId) -> MakeSuperAdminResult {
        match self.get_by_user_id_mut(user_id) {
            Some(p) => match p.role {
                Role::SuperAdmin(_) => MakeSuperAdminResult::AlreadySuperAdmin,
                Role::Owner => MakeSuperAdminResult::AlreadyOwner,
                Role::Admin => {
                    p.role = Role::SuperAdmin(FallbackRole::Admin);
                    MakeSuperAdminResult::Success
                }
                Role::Participant | Role::Viewer => {
                    p.role = Role::SuperAdmin(FallbackRole::Participant);
                    MakeSuperAdminResult::Success
                }
            },
            None => MakeSuperAdminResult::NotInGroup,
        }
    }

    pub fn transfer_ownership(&mut self, caller_id: &UserId, user_id: &UserId) -> TransferOwnershipResult {
        match self.get_by_user_id(caller_id) {
            Some(caller) => {
                if !caller.role.can_transfer_ownership() {
                    return TransferOwnershipResult::CallerNotOwner;
                } else {
                    match self.get_by_user_id(user_id) {
                        Some(user) => {
                            if user.role.is_owner() {
                                // Should not happen. Means > 1 owner!
                                return TransferOwnershipResult::UserAlreadyOwner;
                            } else if user.role.is_super_admin() {
                                return TransferOwnershipResult::UserAlreadySuperAdmin;
                            }
                        }
                        None => return TransferOwnershipResult::UserNotInGroup,
                    }
                }
            }
            None => return TransferOwnershipResult::CallerNotInGroup,
        }

        let curr_owner_id = self.iter().find(|p| p.role.is_owner()).map(|p| p.user_id);

        if let Some(curr_owner_id) = curr_owner_id {
            if let Some(curr_owner) = self.get_by_user_id_mut(&curr_owner_id) {
                curr_owner.role = Role::Admin;
                self.admin_count += 1;
            }
        }

        if let Some(user) = self.get_by_user_id_mut(user_id) {
            let was_user_admin = user.role.is_admin();
            user.role = Role::Owner;
            if was_user_admin {
                self.admin_count -= 1;
            }
        }

        TransferOwnershipResult::Success(curr_owner_id)
    }

    pub fn dismiss_admin(&mut self, user_id: &UserId) -> DismissAdminResult {
        match self.get_by_user_id_mut(user_id) {
            Some(p) => match p.role {
                Role::Admin => p.role = Role::Participant,
                Role::SuperAdmin(FallbackRole::Admin) => p.role = Role::SuperAdmin(FallbackRole::Participant),
                _ => return DismissAdminResult::UserNotAdmin,
            },
            None => return DismissAdminResult::UserNotInGroup,
        }

        self.admin_count -= 1;
        DismissAdminResult::Success
    }

    pub fn dismiss_super_admin(&mut self, user_id: &UserId) -> DismissSuperAdminResult {
        match self.get_by_user_id_mut(user_id) {
            Some(p) => {
                if let Role::SuperAdmin(fallback_role) = p.role {
                    p.role = fallback_role.into();
                    DismissSuperAdminResult::Success
                } else {
                    DismissSuperAdminResult::NotSuperAdmin
                }
            }
            None => DismissSuperAdminResult::NotInGroup,
        }
    }

    pub fn admin_count(&self) -> u32 {
        self.admin_count
    }

    pub fn viewer_count(&self) -> u32 {
        self.viewer_count
    }

    pub fn add_mention(&mut self, user_id: &UserId, message_index: MessageIndex) -> bool {
        if let Some(p) = self.get_by_user_id_mut(user_id) {
            if p.mentions.is_empty() || (message_index > *p.mentions.last().unwrap()) {
                p.mentions.push(message_index);
                return true;
            }
        }

        false
    }
}

pub enum AddResult {
    Success(ParticipantInternal),
    AlreadyInGroup,
    Blocked,
}

pub enum MakeAdminResult {
    Success,
    NotInGroup,
    AlreadyAdmin,
    AlreadyOwner,
}

pub enum MakeSuperAdminResult {
    Success,
    NotInGroup,
    AlreadySuperAdmin,
    AlreadyOwner,
}

pub enum TransferOwnershipResult {
    Success(Option<UserId>),
    UserNotInGroup,
    UserAlreadyOwner,
    UserAlreadySuperAdmin,
    CallerNotInGroup,
    CallerNotOwner,
}

pub enum DismissAdminResult {
    Success,
    UserNotInGroup,
    UserNotAdmin,
}

pub enum DismissSuperAdminResult {
    Success,
    NotInGroup,
    NotSuperAdmin,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct ParticipantInternal {
    pub user_id: UserId,
    pub date_added: TimestampMillis,
    pub role: Role,
    pub notifications_muted: bool,
    pub mentions: Vec<MessageIndex>,

    min_visible_event_index: EventIndex,
    min_visible_message_index: MessageIndex,
}

impl ParticipantInternal {
    pub fn min_visible_event_index(&self) -> EventIndex {
        if self.role.can_view_full_message_history() {
            EventIndex::default()
        } else {
            self.min_visible_event_index
        }
    }

    pub fn min_visible_message_index(&self) -> MessageIndex {
        if self.role.can_view_full_message_history() {
            MessageIndex::default()
        } else {
            self.min_visible_message_index
        }
    }

    pub fn get_most_recent_mentions(&self, events: &GroupChatEvents) -> Vec<Mention> {
        self.mentions
            .iter()
            .rev()
            .filter_map(|message_index| events.hydrate_mention(message_index))
            .take(MAX_RETURNED_MENTIONS)
            .collect()
    }
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
