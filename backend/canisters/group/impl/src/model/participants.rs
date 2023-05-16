use crate::model::mentions::Mentions;
use candid::Principal;
use chat_events::ChatEvents;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Vacant;
use std::collections::{BTreeMap, HashMap, HashSet};
use types::{
    EventIndex, GroupPermissions, Mention, MessageIndex, Participant, Role, TimestampMillis, Timestamped, UserId,
    MAX_RETURNED_MENTIONS,
};

const MAX_PARTICIPANTS_PER_GROUP: u32 = 100_000;

#[derive(Serialize, Deserialize, Default)]
pub struct Participants {
    by_principal: HashMap<Principal, ParticipantInternal>,
    user_id_to_principal_map: HashMap<UserId, Principal>,
    blocked: HashSet<UserId>,
    #[serde(default)]
    moderator_count: u32,
    admin_count: u32,
    owner_count: u32,
}

#[allow(clippy::too_many_arguments)]
impl Participants {
    pub fn new(creator_principal: Principal, creator_user_id: UserId, now: TimestampMillis) -> Participants {
        let participant = ParticipantInternal {
            user_id: creator_user_id,
            date_added: now,
            role: Role::Owner,
            min_visible_event_index: EventIndex::default(),
            min_visible_message_index: MessageIndex::default(),
            notifications_muted: Timestamped::new(false, now),
            mentions_v2: Mentions::default(),
            threads: HashSet::new(),
            proposal_votes: BTreeMap::default(),
            suspended: Timestamped::default(),
        };

        Participants {
            by_principal: vec![(creator_principal, participant)].into_iter().collect(),
            user_id_to_principal_map: vec![(creator_user_id, creator_principal)].into_iter().collect(),
            blocked: HashSet::new(),
            moderator_count: 0,
            admin_count: 0,
            owner_count: 1,
        }
    }

    pub fn add(
        &mut self,
        user_id: UserId,
        principal: Principal,
        now: TimestampMillis,
        min_visible_event_index: EventIndex,
        min_visible_message_index: MessageIndex,
        notifications_muted: bool,
    ) -> AddResult {
        if self.blocked.contains(&user_id) {
            AddResult::Blocked
        } else {
            match self.by_principal.entry(principal) {
                Vacant(e) => {
                    let participant = ParticipantInternal {
                        user_id,
                        date_added: now,
                        role: Role::Participant,
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

    pub fn remove(&mut self, user_id: UserId) -> Option<ParticipantInternal> {
        if let Some(principal) = self.user_id_to_principal_map.remove(&user_id) {
            if let Some(participant) = self.by_principal.remove(&principal) {
                match participant.role {
                    Role::Owner => self.owner_count -= 1,
                    Role::Admin => self.admin_count -= 1,
                    Role::Moderator => self.moderator_count -= 1,
                    _ => (),
                }

                return Some(participant);
            }
        }

        None
    }

    pub fn try_undo_remove(&mut self, principal: Principal, participant: ParticipantInternal) {
        let user_id = participant.user_id;
        let role = participant.role;
        if self.by_principal.insert(principal, participant).is_none() {
            self.user_id_to_principal_map.insert(user_id, principal);
            match role {
                Role::Owner => self.owner_count += 1,
                Role::Admin => self.admin_count += 1,
                Role::Moderator => self.moderator_count += 1,
                _ => (),
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

    pub fn get_principal(&self, user_id: &UserId) -> Option<Principal> {
        self.user_id_to_principal_map.get(user_id).copied()
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

    pub fn users_to_notify(&self, thread_participants: Option<Vec<UserId>>) -> HashSet<UserId> {
        if let Some(thread_participants) = thread_participants {
            thread_participants
                .iter()
                .filter(|user_id| self.get_by_user_id(user_id).map_or(false, |p| !p.notifications_muted.value))
                .copied()
                .collect()
        } else {
            self.by_principal
                .values()
                .filter(|p| !p.notifications_muted.value)
                .map(|p| p.user_id)
                .collect()
        }
    }

    pub fn user_limit_reached(&self) -> Option<u32> {
        if self.by_principal.len() >= MAX_PARTICIPANTS_PER_GROUP as usize {
            Some(MAX_PARTICIPANTS_PER_GROUP)
        } else {
            None
        }
    }

    pub fn update_user_principal(&mut self, user_id: UserId, new_principal: Principal) -> bool {
        if let Some(user) = self
            .user_id_to_principal_map
            .get(&user_id)
            .and_then(|p| self.by_principal.remove(p))
        {
            self.user_id_to_principal_map.insert(user_id, new_principal);
            self.by_principal.insert(new_principal, user);
            true
        } else {
            false
        }
    }

    pub fn len(&self) -> u32 {
        self.by_principal.len() as u32
    }

    pub fn change_role(
        &mut self,
        caller_id: UserId,
        user_id: UserId,
        new_role: Role,
        permissions: &GroupPermissions,
        is_caller_platform_moderator: bool,
        is_user_platform_moderator: bool,
    ) -> ChangeRoleResult {
        // Is the caller authorized to change the user to this role
        match self.get_by_user_id(&caller_id) {
            Some(p) => {
                if p.suspended.value {
                    return ChangeRoleResult::UserSuspended;
                }
                // Platform moderators can always promote themselves to owner
                if !(p.role.can_change_roles(new_role, permissions) || (is_caller_platform_moderator && new_role.is_owner())) {
                    return ChangeRoleResult::NotAuthorized;
                }
            }
            None => return ChangeRoleResult::CallerNotInGroup,
        }

        let mut owner_count = self.owner_count;
        let mut admin_count = self.admin_count;
        let mut moderator_count = self.moderator_count;

        let member = match self.get_by_user_id_mut(&user_id) {
            Some(p) => p,
            None => return ChangeRoleResult::UserNotInGroup,
        };

        // Platform moderators cannot be demoted from owner except by themselves
        if is_user_platform_moderator && member.role.is_owner() && user_id != caller_id {
            return ChangeRoleResult::NotAuthorized;
        }

        // It is not possible to change the role of the last owner
        if member.role.is_owner() && owner_count <= 1 {
            return ChangeRoleResult::Invalid;
        }

        let prev_role = member.role;

        if prev_role == new_role {
            return ChangeRoleResult::Unchanged;
        }

        match member.role {
            Role::Owner => owner_count -= 1,
            Role::Admin => admin_count -= 1,
            Role::Moderator => moderator_count -= 1,
            _ => (),
        }

        member.role = new_role;

        match member.role {
            Role::Owner => owner_count += 1,
            Role::Admin => admin_count += 1,
            Role::Moderator => moderator_count += 1,
            _ => (),
        }

        self.owner_count = owner_count;
        self.admin_count = admin_count;
        self.moderator_count = moderator_count;

        ChangeRoleResult::Success(ChangeRoleSuccessResult { caller_id, prev_role })
    }

    pub fn owner_count(&self) -> u32 {
        self.owner_count
    }

    pub fn admin_count(&self) -> u32 {
        self.admin_count
    }

    pub fn moderator_count(&self) -> u32 {
        self.moderator_count
    }

    pub fn add_thread(&mut self, user_id: &UserId, root_message_index: MessageIndex) {
        if let Some(p) = self.get_by_user_id_mut(user_id) {
            p.threads.insert(root_message_index);
        }
    }
}

#[allow(clippy::large_enum_variant)]
pub enum AddResult {
    Success(ParticipantInternal),
    AlreadyInGroup,
    Blocked,
}

pub enum ChangeRoleResult {
    Success(ChangeRoleSuccessResult),
    CallerNotInGroup,
    NotAuthorized,
    UserNotInGroup,
    Unchanged,
    Invalid,
    UserSuspended,
}

pub struct ChangeRoleSuccessResult {
    pub caller_id: UserId,
    pub prev_role: Role,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ParticipantInternal {
    pub user_id: UserId,
    pub date_added: TimestampMillis,
    pub role: Role,
    pub notifications_muted: Timestamped<bool>,
    pub mentions_v2: Mentions,
    pub threads: HashSet<MessageIndex>,
    pub proposal_votes: BTreeMap<TimestampMillis, Vec<MessageIndex>>,
    pub suspended: Timestamped<bool>,

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

    pub fn most_recent_mentions(
        &self,
        since: Option<TimestampMillis>,
        chat_events: &ChatEvents,
        now: TimestampMillis,
    ) -> Vec<Mention> {
        let min_visible_event_index = self.min_visible_event_index();

        self.mentions_v2
            .iter_most_recent(since)
            .filter_map(|m| chat_events.hydrate_mention(min_visible_event_index, m, now))
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
