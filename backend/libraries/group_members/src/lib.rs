mod mentions;

use crate::mentions::Mentions;
use candid::Principal;
use chat_events::ChatEvents;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Vacant;
use std::collections::{BTreeMap, HashMap, HashSet};
use types::{
    EventIndex, GroupMember, GroupPermissions, GroupRole, Mention, MessageIndex, TimestampMillis, Timestamped, UserId,
    MAX_RETURNED_MENTIONS,
};

const MAX_MEMBERS_PER_GROUP: u32 = 100_000;

#[derive(Serialize, Deserialize, Default)]
pub struct GroupMembers {
    pub members: HashMap<UserId, GroupMemberInternal>,
    pub blocked: HashSet<UserId>,
    pub moderator_count: u32,
    pub admin_count: u32,
    pub owner_count: u32,
}

#[allow(clippy::too_many_arguments)]
impl GroupMembers {
    pub fn new(creator_user_id: UserId, now: TimestampMillis) -> GroupMembers {
        let member = GroupMemberInternal {
            user_id: creator_user_id,
            date_added: now,
            role: GroupRole::Owner,
            min_visible_event_index: EventIndex::default(),
            min_visible_message_index: MessageIndex::default(),
            notifications_muted: Timestamped::new(false, now),
            mentions_v2: Mentions::default(),
            threads: HashSet::new(),
            proposal_votes: BTreeMap::default(),
            suspended: Timestamped::default(),
        };

        GroupMembers {
            members: vec![(creator_user_id, member)].into_iter().collect(),
            blocked: HashSet::new(),
            moderator_count: 0,
            admin_count: 0,
            owner_count: 1,
        }
    }

    pub fn add(
        &mut self,
        user_id: UserId,
        now: TimestampMillis,
        min_visible_event_index: EventIndex,
        min_visible_message_index: MessageIndex,
        notifications_muted: bool,
    ) -> AddResult {
        if self.blocked.contains(&user_id) {
            AddResult::Blocked
        } else {
            match self.members.entry(user_id) {
                Vacant(e) => {
                    let member = GroupMemberInternal {
                        user_id,
                        date_added: now,
                        role: GroupRole::Participant,
                        min_visible_event_index,
                        min_visible_message_index,
                        notifications_muted: Timestamped::new(notifications_muted, now),
                        mentions_v2: Mentions::default(),
                        threads: HashSet::new(),
                        proposal_votes: BTreeMap::default(),
                        suspended: Timestamped::default(),
                    };
                    e.insert(member.clone());
                    AddResult::Success(member)
                }
                _ => AddResult::AlreadyInGroup,
            }
        }
    }

    pub fn remove(&mut self, user_id: UserId) -> Option<GroupMemberInternal> {
        if let Some(member) = self.members.remove(&user_id) {
            match member.role {
                GroupRole::Owner => self.owner_count -= 1,
                GroupRole::Admin => self.admin_count -= 1,
                GroupRole::Moderator => self.moderator_count -= 1,
                _ => (),
            }

            Some(member)
        } else {
            None
        }
    }

    pub fn try_undo_remove(&mut self, member: GroupMemberInternal) {
        let user_id = member.user_id;
        let role = member.role;
        if self.members.insert(user_id, member).is_none() {
            match role {
                GroupRole::Owner => self.owner_count += 1,
                GroupRole::Admin => self.admin_count += 1,
                GroupRole::Moderator => self.moderator_count += 1,
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

    pub fn iter(&self) -> impl Iterator<Item = &GroupMemberInternal> {
        self.members.values()
    }

    pub fn get(&self, user_id: &UserId) -> Option<&GroupMemberInternal> {
        self.members.get(user_id)
    }

    pub fn get_mut(&mut self, user_id: &UserId) -> Option<&mut GroupMemberInternal> {
        self.members.get_mut(user_id)
    }

    pub fn is_blocked(&self, user_id: &UserId) -> bool {
        self.blocked.contains(user_id)
    }

    pub fn users_to_notify(&self, thread_participants: Option<Vec<UserId>>) -> HashSet<UserId> {
        if let Some(thread_participants) = thread_participants {
            thread_participants
                .iter()
                .filter(|user_id| self.get(user_id).map_or(false, |p| !p.notifications_muted.value))
                .copied()
                .collect()
        } else {
            self.members
                .values()
                .filter(|p| !p.notifications_muted.value)
                .map(|p| p.user_id)
                .collect()
        }
    }

    pub fn user_limit_reached(&self) -> Option<u32> {
        if self.members.len() >= MAX_MEMBERS_PER_GROUP as usize {
            Some(MAX_MEMBERS_PER_GROUP)
        } else {
            None
        }
    }

    pub fn len(&self) -> u32 {
        self.members.len() as u32
    }

    pub fn change_role(
        &mut self,
        caller_id: UserId,
        user_id: UserId,
        new_role: GroupRole,
        permissions: &GroupPermissions,
        is_caller_platform_moderator: bool,
        is_user_platform_moderator: bool,
    ) -> ChangeRoleResult {
        // Is the caller authorized to change the user to this role
        match self.get(&caller_id) {
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

        let member = match self.get_mut(&user_id) {
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
            GroupRole::Owner => owner_count -= 1,
            GroupRole::Admin => admin_count -= 1,
            GroupRole::Moderator => moderator_count -= 1,
            _ => (),
        }

        member.role = new_role;

        match member.role {
            GroupRole::Owner => owner_count += 1,
            GroupRole::Admin => admin_count += 1,
            GroupRole::Moderator => moderator_count += 1,
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
        if let Some(p) = self.get_mut(user_id) {
            p.threads.insert(root_message_index);
        }
    }
}

#[allow(clippy::large_enum_variant)]
pub enum AddResult {
    Success(GroupMemberInternal),
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
    pub prev_role: GroupRole,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GroupMemberInternal {
    pub user_id: UserId,
    pub date_added: TimestampMillis,
    pub role: GroupRole,
    pub notifications_muted: Timestamped<bool>,
    pub mentions_v2: Mentions,
    pub threads: HashSet<MessageIndex>,
    pub proposal_votes: BTreeMap<TimestampMillis, Vec<MessageIndex>>,
    pub suspended: Timestamped<bool>,

    min_visible_event_index: EventIndex,
    min_visible_message_index: MessageIndex,
}

impl GroupMemberInternal {
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

impl From<GroupMemberInternal> for GroupMember {
    fn from(p: GroupMemberInternal) -> Self {
        GroupMember {
            user_id: p.user_id,
            date_added: p.date_added,
            role: p.role,
        }
    }
}

impl From<&GroupMemberInternal> for GroupMember {
    fn from(p: &GroupMemberInternal) -> Self {
        GroupMember {
            user_id: p.user_id,
            date_added: p.date_added,
            role: p.role,
        }
    }
}
