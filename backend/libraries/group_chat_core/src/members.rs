use crate::members::stable_memory::MembersStableStorage;
use crate::mentions::Mentions;
use crate::roles::GroupRoleInternal;
use crate::AccessRulesInternal;
use candid::Principal;
use constants::{calculate_summary_updates_data_removal_cutoff, ONE_MB};
use group_community_common::{Member, MemberUpdate, Members};
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use std::cell::OnceCell;
use std::cmp::max;
use std::collections::{BTreeMap, BTreeSet};
use std::ops::Deref;
use types::{
    is_default, EventIndex, GroupMember, GroupPermissions, MessageIndex, MultiUserChat, TimestampMillis, Timestamped, UserId,
    UserType, Version,
};
use utils::timestamped_set::TimestampedSet;

#[cfg(test)]
mod proptests;
mod stable_memory;

const MAX_MEMBERS_PER_GROUP: u32 = 100_000;

#[derive(Serialize, Deserialize)]
pub struct GroupMembers {
    #[serde(alias = "stable_memory_members_map")]
    members_map: MembersStableStorage,
    member_ids: BTreeSet<UserId>,
    owners: BTreeSet<UserId>,
    admins: BTreeSet<UserId>,
    moderators: BTreeSet<UserId>,
    bots: BTreeMap<UserId, UserType>,
    notifications_unmuted: BTreeSet<UserId>,
    lapsed: BTreeSet<UserId>,
    blocked: BTreeSet<UserId>,
    suspended: BTreeSet<UserId>,
    updates: BTreeSet<(TimestampMillis, UserId, MemberUpdate)>,
    latest_update_removed: TimestampMillis,
}

#[allow(clippy::too_many_arguments)]
impl GroupMembers {
    pub fn new(creator_user_id: UserId, user_type: UserType, chat: MultiUserChat, now: TimestampMillis) -> GroupMembers {
        let member = GroupMemberInternal {
            user_id: creator_user_id,
            date_added: now,
            role: Timestamped::new(GroupRoleInternal::Owner, now),
            min_visible_event_index: EventIndex::default(),
            min_visible_message_index: MessageIndex::default(),
            notifications_muted: Timestamped::new(false, now),
            mentions: Mentions::default(),
            followed_threads: TimestampedSet::new(),
            unfollowed_threads: TimestampedSet::new(),
            proposal_votes: BTreeSet::default(),
            latest_proposal_vote_removed: 0,
            suspended: Timestamped::default(),
            rules_accepted: Some(Timestamped::new(Version::zero(), now)),
            user_type,
            lapsed: Timestamped::default(),
        };

        GroupMembers {
            members_map: MembersStableStorage::new(chat, member),
            member_ids: [creator_user_id].into_iter().collect(),
            owners: [creator_user_id].into_iter().collect(),
            admins: BTreeSet::new(),
            moderators: BTreeSet::new(),
            blocked: BTreeSet::new(),
            bots: if user_type.is_bot() {
                [(creator_user_id, user_type)].into_iter().collect()
            } else {
                BTreeMap::new()
            },
            notifications_unmuted: [creator_user_id].into_iter().collect(),
            lapsed: BTreeSet::new(),
            suspended: BTreeSet::new(),
            updates: BTreeSet::new(),
            latest_update_removed: 0,
        }
    }

    pub fn set_chat(&mut self, chat: MultiUserChat) {
        self.members_map.set_chat(chat);
    }

    pub fn read_members_as_bytes_from_stable_memory(&self, after: Option<UserId>) -> Vec<(UserId, ByteBuf)> {
        self.members_map.read_members_as_bytes(after, 2 * ONE_MB as usize)
    }

    pub fn write_members_from_bytes_to_stable_memory(chat: MultiUserChat, members: Vec<(UserId, ByteBuf)>) -> Option<UserId> {
        stable_memory::write_members_from_bytes(chat, members)
    }

    pub fn add(
        &mut self,
        user_id: UserId,
        now: TimestampMillis,
        min_visible_event_index: EventIndex,
        min_visible_message_index: MessageIndex,
        notifications_muted: bool,
        user_type: UserType,
    ) -> AddResult {
        if self.blocked.contains(&user_id) {
            AddResult::Blocked
        } else if let Some(limit) = self.user_limit_reached() {
            AddResult::MemberLimitReached(limit)
        } else if self.member_ids.insert(user_id) {
            let member = GroupMemberInternal {
                user_id,
                date_added: now,
                role: Timestamped::new(GroupRoleInternal::Member, 0),
                min_visible_event_index,
                min_visible_message_index,
                notifications_muted: Timestamped::new(notifications_muted, 0),
                mentions: Mentions::default(),
                followed_threads: TimestampedSet::default(),
                unfollowed_threads: TimestampedSet::default(),
                proposal_votes: BTreeSet::default(),
                latest_proposal_vote_removed: 0,
                suspended: Timestamped::default(),
                rules_accepted: None,
                user_type,
                lapsed: Timestamped::default(),
            };
            self.members_map.insert(member.clone());
            if user_type.is_bot() {
                self.bots.insert(user_id, user_type);
            }
            if !notifications_muted {
                self.notifications_unmuted.insert(user_id);
            }
            self.prune_then_insert_member_update(user_id, MemberUpdate::Added, now);
            AddResult::Success(AddMemberSuccess { member, unlapse: false })
        } else {
            AddResult::AlreadyInGroup
        }
    }

    pub fn remove(&mut self, user_id: UserId, now: TimestampMillis) -> Option<GroupMemberInternal> {
        if let Some(member) = self.members_map.remove(&user_id) {
            match member.role.value {
                GroupRoleInternal::Owner => self.owners.remove(&user_id),
                GroupRoleInternal::Admin => self.admins.remove(&user_id),
                GroupRoleInternal::Moderator => self.moderators.remove(&user_id),
                _ => false,
            };
            if member.user_type.is_bot() {
                self.bots.remove(&user_id);
            }
            if !member.notifications_muted.value {
                self.notifications_unmuted.remove(&user_id);
            }
            if member.lapsed.value {
                self.lapsed.remove(&user_id);
            }
            if member.suspended.value {
                self.suspended.remove(&user_id);
            }
            self.member_ids.remove(&user_id);
            self.prune_then_insert_member_update(user_id, MemberUpdate::Removed, now);
            Some(member)
        } else {
            None
        }
    }

    pub fn block(&mut self, user_id: UserId, now: TimestampMillis) -> bool {
        if self.blocked.insert(user_id) {
            self.prune_then_insert_member_update(user_id, MemberUpdate::Blocked, now);
            true
        } else {
            false
        }
    }

    pub fn unblock(&mut self, user_id: UserId, now: TimestampMillis) -> bool {
        if self.blocked.remove(&user_id) {
            self.prune_then_insert_member_update(user_id, MemberUpdate::Unblocked, now);
            true
        } else {
            false
        }
    }

    pub fn blocked(&self) -> Vec<UserId> {
        self.blocked.iter().copied().collect()
    }

    pub fn get_verified_member(&self, user_id: UserId) -> Result<VerifiedGroupMember, VerifyMemberError> {
        if !self.member_ids.contains(&user_id) {
            Err(VerifyMemberError::NotFound)
        } else if self.suspended.contains(&user_id) {
            Err(VerifyMemberError::Suspended)
        } else if self.lapsed.contains(&user_id) {
            Err(VerifyMemberError::Lapsed)
        } else {
            Ok(VerifiedGroupMember {
                user_id,
                members: self,
                member: OnceCell::new(),
            })
        }
    }

    pub fn member_ids(&self) -> &BTreeSet<UserId> {
        &self.member_ids
    }

    pub fn get(&self, user_id: &UserId) -> Option<GroupMemberInternal> {
        self.members_map.get(user_id)
    }

    pub fn get_bot(&self, bot_user_id: &UserId) -> Option<GroupMemberInternal> {
        self.get(bot_user_id).filter(|m| m.user_type.is_bot())
    }

    pub fn contains(&self, user_id: &UserId) -> bool {
        self.member_ids.contains(user_id)
    }

    pub fn update_member<F: FnOnce(&mut GroupMemberInternal) -> bool>(
        &mut self,
        user_id: &UserId,
        update_fn: F,
    ) -> Option<bool> {
        let mut member = self.members_map.get(user_id)?;

        let updated = update_fn(&mut member);
        if updated {
            self.members_map.insert(member);
        }
        Some(updated)
    }

    pub fn is_blocked(&self, user_id: &UserId) -> bool {
        self.blocked.contains(user_id)
    }

    pub fn user_limit_reached(&self) -> Option<u32> {
        if self.member_ids.len() >= MAX_MEMBERS_PER_GROUP as usize {
            Some(MAX_MEMBERS_PER_GROUP)
        } else {
            None
        }
    }

    pub fn len(&self) -> u32 {
        self.member_ids.len() as u32
    }

    pub fn is_empty(&self) -> bool {
        self.member_ids.is_empty()
    }

    pub fn change_role(
        &mut self,
        caller_id: UserId,
        user_id: UserId,
        new_role: GroupRoleInternal,
        permissions: &GroupPermissions,
        is_caller_platform_moderator: bool,
        is_user_platform_moderator: bool,
        now: TimestampMillis,
    ) -> ChangeRoleResult {
        use ChangeRoleResult::*;

        // Is the caller authorized to change the user to this role
        match self.get_verified_member(caller_id) {
            Ok(member) => {
                // Platform moderators can always promote themselves to owner
                if !(member.role.can_change_roles(new_role, permissions)
                    || (is_caller_platform_moderator && new_role.is_owner()))
                {
                    return NotAuthorized;
                }
            }
            Err(error) => {
                return match error {
                    VerifyMemberError::NotFound => UserNotInGroup,
                    VerifyMemberError::Lapsed => UserLapsed,
                    VerifyMemberError::Suspended => UserSuspended,
                }
            }
        }

        let member = match self.members_map.get(&user_id) {
            Some(p) => p,
            None => return TargetUserNotInGroup,
        };

        // Platform moderators cannot be demoted from owner except by themselves
        if is_user_platform_moderator && member.role.is_owner() && user_id != caller_id {
            return NotAuthorized;
        }

        // It is not possible to change the role of the last owner
        if member.role.is_owner() && self.owners.len() <= 1 {
            return Invalid;
        }
        // It is not currently possible to make a bot an owner
        if member.user_type.is_3rd_party_bot() && new_role.is_owner() {
            return Invalid;
        }

        let prev_role = member.role.value;

        if prev_role == new_role {
            return Unchanged;
        }

        match prev_role {
            GroupRoleInternal::Owner => self.owners.remove(&user_id),
            GroupRoleInternal::Admin => self.admins.remove(&user_id),
            GroupRoleInternal::Moderator => self.moderators.remove(&user_id),
            _ => false,
        };

        self.update_member(&user_id, |m| {
            m.role = Timestamped::new(new_role, now);
            true
        });

        match new_role {
            GroupRoleInternal::Owner => {
                if member.lapsed.value {
                    self.update_lapsed(user_id, false, now);
                }
                self.owners.insert(user_id)
            }
            GroupRoleInternal::Admin => self.admins.insert(user_id),
            GroupRoleInternal::Moderator => self.moderators.insert(user_id),
            _ => false,
        };

        self.prune_then_insert_member_update(user_id, MemberUpdate::RoleChanged, now);

        Success(ChangeRoleSuccess { prev_role })
    }

    pub fn toggle_notifications_muted(
        &mut self,
        user_id: UserId,
        notifications_muted: bool,
        now: TimestampMillis,
    ) -> Option<bool> {
        if !self.member_ids.contains(&user_id) {
            None
        } else {
            let updated = if notifications_muted {
                self.notifications_unmuted.remove(&user_id)
            } else {
                self.notifications_unmuted.insert(user_id)
            };
            if updated {
                self.update_member(&user_id, |m| {
                    m.notifications_muted = Timestamped::new(notifications_muted, now);
                    true
                });
            }
            Some(updated)
        }
    }

    pub fn register_proposal_vote(&mut self, user_id: &UserId, message_index: MessageIndex, now: TimestampMillis) {
        self.update_member(user_id, |m| {
            m.prune_proposal_votes(now);
            m.proposal_votes.insert((now, message_index));
            true
        });
    }

    pub fn set_suspended(&mut self, user_id: UserId, suspended: bool, now: TimestampMillis) -> Option<bool> {
        if !self.member_ids.contains(&user_id) {
            None
        } else {
            let updated = if suspended { self.suspended.insert(user_id) } else { self.suspended.remove(&user_id) };
            if updated {
                self.update_member(&user_id, |m| {
                    m.suspended = Timestamped::new(suspended, now);
                    true
                });
            }
            Some(updated)
        }
    }

    pub fn unlapse_all(&mut self, now: TimestampMillis) {
        self.prune_member_updates(now);
        for user_id in std::mem::take(&mut self.lapsed) {
            if matches!(self.update_member(&user_id, |m| m.set_lapsed(false, now)), Some(true)) {
                self.updates.insert((now, user_id, MemberUpdate::Unlapsed));
            }
        }
    }

    pub fn update_lapsed(&mut self, user_id: UserId, lapsed: bool, now: TimestampMillis) {
        if !self.member_ids.contains(&user_id) {
            return;
        }
        if lapsed && self.owners.contains(&user_id) {
            // Owners can't lapse
            return;
        }

        let updated = if lapsed { self.lapsed.insert(user_id) } else { self.lapsed.remove(&user_id) };

        if updated {
            self.update_member(&user_id, |m| m.set_lapsed(lapsed, now));

            self.prune_then_insert_member_update(
                user_id,
                if lapsed { MemberUpdate::Lapsed } else { MemberUpdate::Unlapsed },
                now,
            );
        }
    }

    pub fn owners(&self) -> &BTreeSet<UserId> {
        &self.owners
    }

    pub fn admins(&self) -> &BTreeSet<UserId> {
        &self.admins
    }

    pub fn moderators(&self) -> &BTreeSet<UserId> {
        &self.moderators
    }

    pub fn bots(&self) -> &BTreeMap<UserId, UserType> {
        &self.bots
    }

    pub fn notifications_unmuted(&self) -> &BTreeSet<UserId> {
        &self.notifications_unmuted
    }

    pub fn lapsed(&self) -> &BTreeSet<UserId> {
        &self.lapsed
    }

    pub fn suspended(&self) -> &BTreeSet<UserId> {
        &self.suspended
    }

    pub fn has_membership_changed(&self, since: TimestampMillis) -> bool {
        self.iter_latest_updates(since)
            .any(|(_, u)| matches!(u, MemberUpdate::Added | MemberUpdate::Removed))
    }

    pub fn iter_latest_updates(&self, since: TimestampMillis) -> impl Iterator<Item = (UserId, MemberUpdate)> + '_ {
        self.updates
            .iter()
            .rev()
            .take_while(move |(ts, _, _)| *ts > since)
            .map(|(_, user_id, update)| (*user_id, *update))
    }

    pub fn last_updated(&self) -> Option<TimestampMillis> {
        self.updates.iter().next_back().map(|(ts, _, _)| *ts)
    }

    pub fn any_updates_removed(&self, since: TimestampMillis) -> bool {
        self.latest_update_removed > since
    }

    fn prune_then_insert_member_update(&mut self, user_id: UserId, update: MemberUpdate, now: TimestampMillis) {
        self.prune_member_updates(now);
        self.updates.insert((now, user_id, update));
    }

    fn prune_member_updates(&mut self, now: TimestampMillis) -> u32 {
        let cutoff = calculate_summary_updates_data_removal_cutoff(now);
        let still_valid = self
            .updates
            .split_off(&(cutoff, Principal::anonymous().into(), MemberUpdate::Added));

        let removed = std::mem::replace(&mut self.updates, still_valid);

        if let Some((ts, _, _)) = removed.last() {
            self.latest_update_removed = *ts;
        }

        removed.len() as u32
    }

    #[cfg(test)]
    fn check_invariants(&self) {
        let mut member_ids = BTreeSet::new();
        let mut owners = BTreeSet::new();
        let mut admins = BTreeSet::new();
        let mut moderators = BTreeSet::new();
        let mut notifications_unmuted = BTreeSet::new();
        let mut lapsed = BTreeSet::new();
        let mut suspended = BTreeSet::new();

        let all_members = self.members_map.all_members();

        for member in all_members {
            member_ids.insert(member.user_id);

            match member.role.value {
                GroupRoleInternal::Owner => owners.insert(member.user_id),
                GroupRoleInternal::Admin => admins.insert(member.user_id),
                GroupRoleInternal::Moderator => moderators.insert(member.user_id),
                GroupRoleInternal::Member => false,
            };

            if !member.notifications_muted.value {
                notifications_unmuted.insert(member.user_id);
            }

            if member.lapsed.value {
                lapsed.insert(member.user_id);
            }

            if member.suspended.value {
                suspended.insert(member.user_id);
            }
        }

        assert_eq!(member_ids, self.member_ids);
        assert_eq!(owners, self.owners);
        assert_eq!(admins, self.admins);
        assert_eq!(moderators, self.moderators);
        assert_eq!(notifications_unmuted, self.notifications_unmuted);
        assert_eq!(lapsed, self.lapsed);
        assert_eq!(suspended, self.suspended);
    }
}

impl Members for GroupMembers {
    type Member = GroupMemberInternal;

    fn get(&self, user_id: &UserId) -> Option<GroupMemberInternal> {
        self.get(user_id)
    }

    fn can_member_lapse(&self, user_id: &UserId) -> bool {
        self.member_ids.contains(user_id) && !self.owners.contains(user_id) && !self.lapsed.contains(user_id)
    }

    fn iter_members_who_can_lapse(&self) -> Box<dyn Iterator<Item = UserId> + '_> {
        Box::new(
            self.member_ids
                .iter()
                .filter(|id| !self.owners.contains(id) && !self.lapsed.contains(id))
                .copied(),
        )
    }
}

#[allow(clippy::large_enum_variant)]
pub enum AddResult {
    Success(AddMemberSuccess),
    AlreadyInGroup,
    MemberLimitReached(u32),
    Blocked,
}

pub struct AddMemberSuccess {
    pub member: GroupMemberInternal,
    pub unlapse: bool,
}

pub enum ChangeRoleResult {
    Success(ChangeRoleSuccess),
    UserNotInGroup,
    NotAuthorized,
    TargetUserNotInGroup,
    Unchanged,
    Invalid,
    UserSuspended,
    UserLapsed,
}

pub struct ChangeRoleSuccess {
    pub prev_role: GroupRoleInternal,
}

#[derive(Clone)]
pub struct GroupMemberInternal {
    user_id: UserId,
    date_added: TimestampMillis,
    role: Timestamped<GroupRoleInternal>,
    notifications_muted: Timestamped<bool>,
    pub mentions: Mentions,
    pub followed_threads: TimestampedSet<MessageIndex>,
    pub unfollowed_threads: TimestampedSet<MessageIndex>,
    proposal_votes: BTreeSet<(TimestampMillis, MessageIndex)>,
    latest_proposal_vote_removed: TimestampMillis,
    suspended: Timestamped<bool>,
    pub rules_accepted: Option<Timestamped<Version>>,
    user_type: UserType,
    min_visible_event_index: EventIndex,
    min_visible_message_index: MessageIndex,
    lapsed: Timestamped<bool>,
}

impl GroupMemberInternal {
    pub fn user_id(&self) -> UserId {
        self.user_id
    }

    pub fn date_added(&self) -> TimestampMillis {
        self.date_added
    }

    pub fn role(&self) -> &Timestamped<GroupRoleInternal> {
        &self.role
    }

    pub fn user_type(&self) -> UserType {
        self.user_type
    }

    pub fn notifications_muted(&self) -> &Timestamped<bool> {
        &self.notifications_muted
    }

    pub fn lapsed(&self) -> &Timestamped<bool> {
        &self.lapsed
    }

    pub fn suspended(&self) -> &Timestamped<bool> {
        &self.suspended
    }

    pub fn last_updated(&self) -> TimestampMillis {
        [
            self.date_added,
            self.role.timestamp,
            self.notifications_muted.timestamp,
            self.suspended.timestamp,
            self.rules_accepted.as_ref().map(|r| r.timestamp).unwrap_or_default(),
            self.lapsed.timestamp,
        ]
        .into_iter()
        .max()
        .unwrap()
    }

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

    pub fn accept_rules(&mut self, version: Version, now: TimestampMillis) {
        let current_version = self
            .rules_accepted
            .as_ref()
            .map(|accepted| accepted.value)
            .unwrap_or_default();

        self.rules_accepted = Some(Timestamped::new(max(version, current_version), now));
    }

    pub fn check_rules(&self, rules: &AccessRulesInternal) -> bool {
        !rules.enabled
            || self.user_type.is_bot()
            || (self
                .rules_accepted
                .as_ref()
                .map_or(false, |accepted| accepted.value >= rules.text.version))
    }

    pub fn iter_proposal_votes_since(
        &self,
        since: TimestampMillis,
    ) -> impl Iterator<Item = (TimestampMillis, MessageIndex)> + '_ {
        self.proposal_votes
            .iter()
            .rev()
            .take_while(move |(ts, _)| *ts > since)
            .copied()
    }

    pub fn any_updates_removed(&self, since: TimestampMillis) -> bool {
        self.latest_proposal_vote_removed > since
    }

    fn prune_proposal_votes(&mut self, now: TimestampMillis) -> u32 {
        let cutoff = calculate_summary_updates_data_removal_cutoff(now);
        let still_valid = self.proposal_votes.split_off(&(cutoff, 0.into()));
        let removed = std::mem::replace(&mut self.proposal_votes, still_valid);

        if let Some((ts, _)) = removed.last() {
            self.latest_proposal_vote_removed = *ts;
        }

        removed.len() as u32
    }
}

impl Member for GroupMemberInternal {
    fn user_id(&self) -> UserId {
        self.user_id
    }

    fn is_owner(&self) -> bool {
        self.role.is_owner()
    }

    fn lapsed(&self) -> bool {
        self.lapsed.value
    }

    fn set_lapsed(&mut self, lapsed: bool, timestamp: TimestampMillis) -> bool {
        if lapsed != self.lapsed.value {
            self.lapsed = Timestamped::new(lapsed, timestamp);
            true
        } else {
            false
        }
    }
}

impl From<&GroupMemberInternal> for GroupMember {
    fn from(m: &GroupMemberInternal) -> Self {
        GroupMember {
            user_id: m.user_id,
            date_added: m.date_added,
            role: m.role.value.into(),
            lapsed: m.lapsed.value,
        }
    }
}

pub struct VerifiedGroupMember<'a> {
    user_id: UserId,
    members: &'a GroupMembers,
    member: OnceCell<GroupMemberInternal>,
}

impl VerifiedGroupMember<'_> {
    pub fn user_id(&self) -> UserId {
        self.user_id
    }

    pub fn role(&self) -> GroupRoleInternal {
        if self.members.owners.contains(&self.user_id) {
            GroupRoleInternal::Owner
        } else if self.members.admins.contains(&self.user_id) {
            GroupRoleInternal::Admin
        } else if self.members.moderators.contains(&self.user_id) {
            GroupRoleInternal::Moderator
        } else {
            GroupRoleInternal::Member
        }
    }

    pub fn user_type(&self) -> UserType {
        self.members.bots.get(&self.user_id).copied().unwrap_or_default()
    }

    fn resolve_member(&self) -> &GroupMemberInternal {
        self.member
            .get_or_init(|| self.members.members_map.get(&self.user_id).unwrap())
    }
}

impl Deref for VerifiedGroupMember<'_> {
    type Target = GroupMemberInternal;

    fn deref(&self) -> &Self::Target {
        self.resolve_member()
    }
}

pub enum VerifyMemberError {
    NotFound,
    Lapsed,
    Suspended,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GroupMemberStableStorage {
    #[serde(rename = "d")]
    date_added: TimestampMillis,
    #[serde(rename = "r", default, skip_serializing_if = "is_default")]
    role: Timestamped<GroupRoleInternal>,
    #[serde(
        rename = "n",
        default = "default_notifications_muted",
        skip_serializing_if = "is_default_notifications_muted"
    )]
    notifications_muted: Timestamped<bool>,
    #[serde(rename = "m", default, skip_serializing_if = "Mentions::is_empty")]
    pub mentions: Mentions,
    #[serde(rename = "tf", default, skip_serializing_if = "TimestampedSet::is_empty")]
    pub followed_threads: TimestampedSet<MessageIndex>,
    #[serde(rename = "tu", default, skip_serializing_if = "TimestampedSet::is_empty")]
    pub unfollowed_threads: TimestampedSet<MessageIndex>,
    #[serde(rename = "p", default, skip_serializing_if = "BTreeSet::is_empty")]
    proposal_votes: BTreeSet<(TimestampMillis, MessageIndex)>,
    #[serde(rename = "pr", default, skip_serializing_if = "is_default")]
    latest_proposal_vote_removed: TimestampMillis,
    #[serde(rename = "s", default, skip_serializing_if = "is_default")]
    suspended: Timestamped<bool>,
    #[serde(rename = "ra", default, skip_serializing_if = "is_default")]
    pub rules_accepted: Option<Timestamped<Version>>,
    #[serde(rename = "ut", default, skip_serializing_if = "is_default")]
    user_type: UserType,
    #[serde(rename = "me", default, skip_serializing_if = "is_default")]
    min_visible_event_index: EventIndex,
    #[serde(rename = "mm", default, skip_serializing_if = "is_default")]
    min_visible_message_index: MessageIndex,
    #[serde(rename = "la", default, skip_serializing_if = "is_default")]
    lapsed: Timestamped<bool>,
}

impl GroupMemberStableStorage {
    pub fn hydrate(self, user_id: UserId) -> GroupMemberInternal {
        GroupMemberInternal {
            user_id,
            date_added: self.date_added,
            role: self.role,
            notifications_muted: self.notifications_muted,
            mentions: self.mentions,
            followed_threads: self.followed_threads,
            unfollowed_threads: self.unfollowed_threads,
            proposal_votes: self.proposal_votes,
            latest_proposal_vote_removed: self.latest_proposal_vote_removed,
            suspended: self.suspended,
            rules_accepted: self.rules_accepted,
            user_type: self.user_type,
            min_visible_event_index: self.min_visible_event_index,
            min_visible_message_index: self.min_visible_message_index,
            lapsed: self.lapsed,
        }
    }
}

impl From<GroupMemberInternal> for GroupMemberStableStorage {
    fn from(value: GroupMemberInternal) -> Self {
        GroupMemberStableStorage {
            date_added: value.date_added,
            role: value.role,
            notifications_muted: value.notifications_muted,
            mentions: value.mentions,
            followed_threads: value.followed_threads,
            unfollowed_threads: value.unfollowed_threads,
            proposal_votes: value.proposal_votes,
            latest_proposal_vote_removed: value.latest_proposal_vote_removed,
            suspended: value.suspended,
            rules_accepted: value.rules_accepted,
            user_type: value.user_type,
            min_visible_event_index: value.min_visible_event_index,
            min_visible_message_index: value.min_visible_message_index,
            lapsed: value.lapsed,
        }
    }
}

fn default_notifications_muted() -> Timestamped<bool> {
    Timestamped::new(true, 0)
}

fn is_default_notifications_muted(value: &Timestamped<bool>) -> bool {
    value.value && value.timestamp == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serialize_with_max_defaults() {
        #[derive(Serialize)]
        pub struct GroupMemberInternal2 {
            #[serde(rename = "d")]
            date_added: TimestampMillis,
        }

        let member1 = GroupMemberStableStorage {
            date_added: 1732874138000,
            role: Timestamped::default(),
            notifications_muted: default_notifications_muted(),
            mentions: Mentions::default(),
            followed_threads: TimestampedSet::default(),
            unfollowed_threads: TimestampedSet::default(),
            proposal_votes: BTreeSet::new(),
            latest_proposal_vote_removed: 0,
            suspended: Timestamped::default(),
            min_visible_event_index: 0.into(),
            min_visible_message_index: 0.into(),
            rules_accepted: None,
            user_type: UserType::User,
            lapsed: Timestamped::default(),
        };

        let member2 = GroupMemberInternal2 {
            date_added: member1.date_added,
        };

        let member1_bytes = msgpack::serialize_then_unwrap(&member1);
        let member2_bytes = msgpack::serialize_then_unwrap(&member2);

        assert_eq!(member1_bytes, member2_bytes);
        assert_eq!(member1_bytes.len(), 12);

        let _deserialized: GroupMemberStableStorage = msgpack::deserialize_then_unwrap(&member1_bytes);
    }

    #[test]
    fn serialize_with_no_defaults() {
        let mut mentions = Mentions::default();
        mentions.add(Some(1.into()), 1.into(), 1u64.into(), 1);

        let member = GroupMemberStableStorage {
            date_added: 1732874138000,
            role: Timestamped::new(GroupRoleInternal::Owner, 1),
            notifications_muted: Timestamped::new(true, 1),
            mentions,
            followed_threads: [(1.into(), 1)].into_iter().collect(),
            unfollowed_threads: [(1.into(), 1)].into_iter().collect(),
            proposal_votes: BTreeSet::from([(1, 1.into())]),
            latest_proposal_vote_removed: 1,
            suspended: Timestamped::new(true, 1),
            min_visible_event_index: 1.into(),
            min_visible_message_index: 1.into(),
            rules_accepted: Some(Timestamped::new(Version::zero(), 1)),
            user_type: UserType::Bot,
            lapsed: Timestamped::new(false, 1),
        };

        let member_bytes = msgpack::serialize_then_unwrap(&member);
        let member_bytes_len = member_bytes.len();

        assert_eq!(member_bytes_len, 157);

        let _deserialized: GroupMemberStableStorage = msgpack::deserialize_then_unwrap(&member_bytes);
    }
}
