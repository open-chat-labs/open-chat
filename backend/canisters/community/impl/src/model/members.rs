use crate::model::members::stable_memory::MembersStableStorage;
use crate::model::user_groups::{UserGroup, UserGroups};
use candid::Principal;
use constants::calculate_summary_updates_data_removal_cutoff;
use group_community_common::{Member, MemberUpdate, Members};
use principal_to_user_id_map::PrincipalToUserIdMap;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use stable_memory_map::StableMemoryMap;
use std::collections::btree_map::Entry::Vacant;
use std::collections::{BTreeMap, BTreeSet};
use types::{
    is_default, ChannelId, CommunityMember, CommunityPermissions, CommunityRole, PushIfNotContains, TimestampMillis,
    Timestamped, UserId, UserType, Version,
};

#[cfg(test)]
mod proptests;
mod stable_memory;

const MAX_MEMBERS_PER_COMMUNITY: u32 = 100_000;

#[derive(Serialize, Deserialize)]
pub struct CommunityMembers {
    members_map: MembersStableStorage,
    members_and_channels: BTreeMap<UserId, Vec<ChannelId>>,
    member_channel_links_removed: BTreeMap<(UserId, ChannelId), TimestampMillis>,
    user_groups: UserGroups,
    // This includes the userIds of community members and also users invited to the community
    principal_to_user_id_map: PrincipalToUserIdMap,
    owners: BTreeSet<UserId>,
    admins: BTreeSet<UserId>,
    bots: BTreeMap<UserId, UserType>,
    blocked: BTreeSet<UserId>,
    lapsed: BTreeSet<UserId>,
    suspended: BTreeSet<UserId>,
    members_with_display_names: BTreeSet<UserId>,
    members_with_referrals: BTreeSet<UserId>,
    updates: BTreeSet<(TimestampMillis, UserId, MemberUpdate)>,
    latest_update_removed: TimestampMillis,
}

impl CommunityMembers {
    pub fn new(
        creator_principal: Principal,
        creator_user_id: UserId,
        creator_user_type: UserType,
        public_channels: Vec<ChannelId>,
        now: TimestampMillis,
    ) -> CommunityMembers {
        let member = CommunityMemberInternal {
            user_id: creator_user_id,
            date_added: now,
            role: CommunityRole::Owner,
            suspended: Timestamped::default(),
            rules_accepted: Some(Timestamped::new(Version::zero(), now)),
            user_type: creator_user_type,
            display_name: Timestamped::default(),
            referred_by: None,
            referrals: BTreeSet::new(),
            referrals_removed: BTreeSet::new(),
            lapsed: Timestamped::default(),
        };

        let mut principal_to_user_id_map = PrincipalToUserIdMap::default();
        principal_to_user_id_map.insert(creator_principal, creator_user_id);

        #[allow(deprecated)]
        CommunityMembers {
            members_map: MembersStableStorage::new(member),
            members_and_channels: [(creator_user_id, public_channels)].into_iter().collect(),
            member_channel_links_removed: BTreeMap::new(),
            user_groups: UserGroups::default(),
            principal_to_user_id_map,
            owners: [creator_user_id].into_iter().collect(),
            admins: BTreeSet::new(),
            bots: if creator_user_type.is_bot() {
                [(creator_user_id, creator_user_type)].into_iter().collect()
            } else {
                BTreeMap::new()
            },
            blocked: BTreeSet::new(),
            lapsed: BTreeSet::new(),
            suspended: BTreeSet::new(),
            members_with_display_names: BTreeSet::new(),
            members_with_referrals: BTreeSet::new(),
            updates: BTreeSet::new(),
            latest_update_removed: 0,
        }
    }

    pub fn add(
        &mut self,
        user_id: UserId,
        principal: Principal,
        user_type: UserType,
        mut referred_by: Option<UserId>,
        now: TimestampMillis,
    ) -> AddResult {
        if self.blocked.contains(&user_id) {
            AddResult::Blocked
        } else if let Vacant(e) = self.members_and_channels.entry(user_id) {
            e.insert(Vec::new());

            if referred_by == Some(user_id) {
                referred_by = None;
            }

            let member = CommunityMemberInternal {
                user_id,
                date_added: now,
                role: CommunityRole::Member,
                suspended: Timestamped::default(),
                rules_accepted: None,
                user_type,
                display_name: Timestamped::default(),
                referred_by,
                referrals: BTreeSet::new(),
                referrals_removed: BTreeSet::new(),
                lapsed: Timestamped::default(),
            };
            self.add_user_id(principal, user_id);
            self.members_map.insert(member.user_id, member.clone());
            self.prune_then_insert_member_update(user_id, MemberUpdate::Added, now);

            if let Some(referrer) = referred_by {
                if matches!(
                    self.update_member(&referrer, |m| {
                        m.add_referral(user_id);
                        true
                    }),
                    Some(true)
                ) {
                    self.members_with_referrals.insert(referrer);
                }
            }
            AddResult::Success(member)
        } else {
            AddResult::AlreadyInCommunity
        }
    }

    pub fn add_user_id(&mut self, principal: Principal, user_id: UserId) {
        self.principal_to_user_id_map.insert(principal, user_id);
    }

    pub fn remove_by_principal(&mut self, principal: Principal, now: TimestampMillis) -> Option<CommunityMemberInternal> {
        let user_id = self.principal_to_user_id_map.remove(&principal)?.into_value();
        self.remove(user_id, Some(principal), now)
    }

    pub fn remove(
        &mut self,
        user_id: UserId,
        principal: Option<Principal>,
        now: TimestampMillis,
    ) -> Option<CommunityMemberInternal> {
        if let Some(principal) = principal {
            let user_id_removed = self.principal_to_user_id_map.remove(&principal).map(|v| v.into_value());
            assert_eq!(user_id_removed, Some(user_id));
        }

        let member = self.members_map.remove(&user_id)?.into_value();

        match member.role {
            CommunityRole::Owner => self.owners.remove(&user_id),
            CommunityRole::Admin => self.admins.remove(&user_id),
            _ => false,
        };
        if member.user_type.is_bot() {
            self.bots.remove(&user_id);
        }
        if member.lapsed.value {
            self.lapsed.remove(&user_id);
        }
        if member.suspended.value {
            self.suspended.remove(&user_id);
        }
        if member.display_name.is_some() {
            self.members_with_display_names.remove(&user_id);
        }
        if !member.referrals.is_empty() {
            self.members_with_referrals.remove(&user_id);
        }
        if let Some(referrer) = member.referred_by {
            let mut remove_from_members_with_referrals = false;
            self.update_member(&referrer, |m| {
                m.remove_referral(user_id);
                if m.referrals.is_empty() {
                    remove_from_members_with_referrals = true;
                }
                true
            });
            if remove_from_members_with_referrals {
                self.members_with_referrals.remove(&referrer);
            }
        }
        self.members_and_channels.remove(&user_id);
        let channels_removed: Vec<_> = self.channels_removed_for_member(user_id).map(|(c, _)| c).collect();
        for channel_id in channels_removed {
            self.member_channel_links_removed.remove(&(user_id, channel_id));
        }
        self.user_groups.remove_user_from_all(&member.user_id, now);
        self.prune_then_insert_member_update(user_id, MemberUpdate::Removed, now);

        Some(member)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn change_role(
        &mut self,
        user_id: UserId,
        target_user_id: UserId,
        new_role: CommunityRole,
        permissions: &CommunityPermissions,
        is_caller_platform_moderator: bool,
        is_user_platform_moderator: bool,
        now: TimestampMillis,
    ) -> ChangeRoleResult {
        // Is the caller authorized to change the user to this role
        match self.get_by_user_id(&user_id) {
            Some(p) => {
                if p.suspended.value {
                    return ChangeRoleResult::UserSuspended;
                }
                // Platform moderators can always promote themselves to owner
                if !(p.role.can_change_roles(new_role, permissions) || (is_caller_platform_moderator && new_role.is_owner())) {
                    return ChangeRoleResult::NotAuthorized;
                }
            }
            None => return ChangeRoleResult::UserNotInCommunity,
        }

        let mut member = match self.members_map.get(&target_user_id) {
            Some(p) => p,
            None => return ChangeRoleResult::TargetUserNotInCommunity,
        };

        // Platform moderators cannot be demoted from owner except by themselves
        if is_user_platform_moderator && member.role.is_owner() && target_user_id != user_id {
            return ChangeRoleResult::NotAuthorized;
        }

        // It is not possible to change the role of the last owner
        if member.role.is_owner() && self.owners.len() <= 1 {
            return ChangeRoleResult::Invalid;
        }
        // It is not currently possible to make a bot an owner
        if member.user_type.is_3rd_party_bot() && new_role.is_owner() {
            return ChangeRoleResult::Invalid;
        }

        let prev_role = member.role;

        if prev_role == new_role {
            return ChangeRoleResult::Unchanged;
        }

        match prev_role {
            CommunityRole::Owner => self.owners.remove(&target_user_id),
            CommunityRole::Admin => self.admins.remove(&target_user_id),
            _ => false,
        };

        member.role = new_role;

        match new_role {
            CommunityRole::Owner => {
                if member.lapsed.value {
                    member.lapsed = Timestamped::new(false, now);
                    self.lapsed.remove(&target_user_id);
                }
                self.owners.insert(target_user_id)
            }
            CommunityRole::Admin => self.admins.insert(target_user_id),
            _ => false,
        };

        self.members_map.insert(target_user_id, member);
        self.prune_then_insert_member_update(target_user_id, MemberUpdate::RoleChanged, now);

        ChangeRoleResult::Success(ChangeRoleSuccessResult {
            caller_id: user_id,
            prev_role,
        })
    }

    pub fn set_suspended(&mut self, user_id: UserId, suspended: bool, now: TimestampMillis) -> Option<bool> {
        let result = self.update_member(&user_id, |member| {
            if member.suspended.value != suspended {
                member.suspended = Timestamped::new(suspended, now);
                true
            } else {
                false
            }
        });
        if matches!(result, Some(true)) {
            if suspended {
                self.suspended.insert(user_id);
            } else {
                self.suspended.remove(&user_id);
            }
        }
        result
    }

    pub fn create_user_group<R: RngCore>(
        &mut self,
        name: String,
        mut users: Vec<UserId>,
        rng: &mut R,
        now: TimestampMillis,
    ) -> Option<u32> {
        users.retain(|u| self.members_and_channels.contains_key(u));

        self.user_groups.create(name, users, rng, now)
    }

    pub fn update_user_group(
        &mut self,
        user_group_id: u32,
        name: Option<String>,
        mut users_to_add: Vec<UserId>,
        users_to_remove: Vec<UserId>,
        now: TimestampMillis,
    ) -> bool {
        users_to_add.retain(|u| self.members_and_channels.contains_key(u));

        self.user_groups
            .update(user_group_id, name, users_to_add, users_to_remove, now)
    }

    pub fn delete_user_group(&mut self, user_group_id: u32, now: TimestampMillis) -> bool {
        self.user_groups.delete(user_group_id, now)
    }

    pub fn get_user_group(&self, user_group_id: u32) -> Option<&UserGroup> {
        self.user_groups.get(user_group_id)
    }

    pub fn iter_user_groups(&self) -> impl Iterator<Item = &UserGroup> {
        self.user_groups.iter()
    }

    pub fn user_groups_deleted_since(&self, since: TimestampMillis) -> Vec<u32> {
        self.user_groups.deleted_since(since)
    }

    pub fn user_groups_last_updated(&self) -> TimestampMillis {
        self.user_groups.last_updated()
    }

    pub fn update_user_principal(&mut self, old_principal: Principal, new_principal: Principal) {
        if let Some(user_id) = self.principal_to_user_id_map.remove(&old_principal).map(|v| v.into_value()) {
            self.principal_to_user_id_map.insert(new_principal, user_id);
        }
    }

    pub fn mark_member_joined_channel(&mut self, user_id: UserId, channel_id: ChannelId) {
        if let Some(channel_ids) = self.members_and_channels.get_mut(&user_id) {
            channel_ids.push_if_not_contains(channel_id);
            self.member_channel_links_removed.remove(&(user_id, channel_id));
        }
    }

    pub fn mark_member_left_channel(
        &mut self,
        user_id: UserId,
        channel_id: ChannelId,
        channel_deleted: bool,
        now: TimestampMillis,
    ) {
        if let Some(channel_ids) = self.members_and_channels.get_mut(&user_id) {
            channel_ids.retain(|id| *id != channel_id);
            if !channel_deleted {
                self.member_channel_links_removed.insert((user_id, channel_id), now);
            }
        }
    }

    pub fn mark_rules_accepted(&mut self, user_id: &UserId, version: Version, now: TimestampMillis) {
        self.update_member(user_id, |member| member.accept_rules(version, now));
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

    pub fn user_limit_reached(&self) -> Option<u32> {
        if self.members_and_channels.len() >= MAX_MEMBERS_PER_COMMUNITY as usize {
            Some(MAX_MEMBERS_PER_COMMUNITY)
        } else {
            None
        }
    }

    pub fn is_blocked(&self, user_id: &UserId) -> bool {
        self.blocked.contains(user_id)
    }

    pub fn blocked(&self) -> Vec<UserId> {
        self.blocked.iter().copied().collect()
    }

    pub fn lookup_user_id(&self, user_id_or_principal: Principal) -> Option<UserId> {
        self.principal_to_user_id_map.get(&user_id_or_principal).or_else(|| {
            let user_id: UserId = user_id_or_principal.into();
            self.members_and_channels.contains_key(&user_id).then_some(user_id)
        })
    }

    pub fn get(&self, user_id_or_principal: Principal) -> Option<CommunityMemberInternal> {
        let user_id = user_id_or_principal.into();

        let user_id = self.principal_to_user_id_map.get(&user_id_or_principal).unwrap_or(user_id);

        self.members_map.get(&user_id)
    }

    pub fn get_by_user_id(&self, user_id: &UserId) -> Option<CommunityMemberInternal> {
        self.members_map.get(user_id)
    }

    pub fn contains(&self, user_id: &UserId) -> bool {
        self.members_and_channels.contains_key(user_id)
    }

    pub fn len(&self) -> usize {
        self.members_and_channels.len()
    }

    pub fn iter_member_ids(&self) -> impl Iterator<Item = UserId> + '_ {
        self.members_and_channels.keys().copied()
    }

    pub fn channels_for_member(&self, user_id: UserId) -> &[ChannelId] {
        self.members_and_channels
            .get(&user_id)
            .map(|v| v.as_slice())
            .unwrap_or_default()
    }

    pub fn channels_removed_for_member(&self, user_id: UserId) -> impl Iterator<Item = (ChannelId, TimestampMillis)> + '_ {
        self.member_channel_links_removed
            .range((user_id, ChannelId::from(0u32))..)
            .take_while(move |((u, _), _)| *u == user_id)
            .map(|((_, c), ts)| (*c, *ts))
    }

    pub fn member_channel_links_removed_contains(&self, user_id: UserId, channel_id: ChannelId) -> bool {
        self.member_channel_links_removed.contains_key(&(user_id, channel_id))
    }

    pub fn owners(&self) -> &BTreeSet<UserId> {
        &self.owners
    }

    pub fn admins(&self) -> &BTreeSet<UserId> {
        &self.admins
    }

    pub fn bots(&self) -> &BTreeMap<UserId, UserType> {
        &self.bots
    }

    pub fn lapsed(&self) -> &BTreeSet<UserId> {
        &self.lapsed
    }

    pub fn suspended(&self) -> &BTreeSet<UserId> {
        &self.suspended
    }

    pub fn members_with_display_names(&self) -> &BTreeSet<UserId> {
        &self.members_with_display_names
    }

    pub fn members_with_referrals(&self) -> &BTreeSet<UserId> {
        &self.members_with_referrals
    }

    pub fn set_display_name(&mut self, user_id: UserId, display_name: Option<String>, now: TimestampMillis) {
        let display_name_is_some = display_name.is_some();
        if matches!(
            self.update_member(&user_id, |m| {
                m.display_name = Timestamped::new(display_name, now);
                true
            }),
            Some(true)
        ) {
            if display_name_is_some {
                self.members_with_display_names.insert(user_id);
            } else {
                self.members_with_display_names.remove(&user_id);
            }
            self.prune_then_insert_member_update(user_id, MemberUpdate::DisplayNameChanged, now);
        }
    }

    pub fn update_lapsed(&mut self, user_id: UserId, lapsed: bool, now: TimestampMillis) {
        if matches!(
            self.update_member(&user_id, |m| {
                if lapsed {
                    // Owners can't lapse
                    !m.is_owner() && m.set_lapsed(true, now)
                } else {
                    m.set_lapsed(false, now)
                }
            }),
            Some(true)
        ) {
            if lapsed {
                self.lapsed.insert(user_id);
            } else {
                self.lapsed.remove(&user_id);
            }

            self.prune_then_insert_member_update(
                user_id,
                if lapsed { MemberUpdate::Lapsed } else { MemberUpdate::Unlapsed },
                now,
            );
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

    pub fn iter_latest_updates(&self, since: TimestampMillis) -> impl Iterator<Item = (UserId, MemberUpdate)> + '_ {
        self.updates
            .iter()
            .rev()
            .take_while(move |(ts, _, _)| *ts > since)
            .map(|(_, user_id, update)| (*user_id, *update))
    }

    pub fn last_updated(&self) -> TimestampMillis {
        [
            self.user_groups_last_updated(),
            self.updates.iter().next_back().map_or(0, |(ts, _, _)| *ts),
        ]
        .into_iter()
        .max()
        .unwrap()
    }

    fn update_member<F: FnOnce(&mut CommunityMemberInternal) -> bool>(
        &mut self,
        user_id: &UserId,
        update_fn: F,
    ) -> Option<bool> {
        let mut member = self.members_map.get(user_id)?;

        let updated = update_fn(&mut member);
        if updated {
            self.members_map.insert(member.user_id, member);
        }
        Some(updated)
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
        let mut lapsed = BTreeSet::new();
        let mut suspended = BTreeSet::new();
        let mut members_with_display_names = BTreeSet::new();
        let mut members_with_referrals = BTreeSet::new();

        for member in self.members_map.all_members() {
            member_ids.insert(member.user_id);

            match member.role {
                CommunityRole::Owner => owners.insert(member.user_id),
                CommunityRole::Admin => admins.insert(member.user_id),
                CommunityRole::Member => false,
            };

            if member.lapsed.value {
                lapsed.insert(member.user_id);
            }

            if member.suspended.value {
                suspended.insert(member.user_id);
            }

            if member.display_name.is_some() {
                members_with_display_names.insert(member.user_id);
            }

            if !member.referrals.is_empty() {
                members_with_referrals.insert(member.user_id);
            }
        }

        assert_eq!(member_ids, self.members_and_channels.keys().copied().collect::<BTreeSet<_>>());
        assert_eq!(owners, self.owners);
        assert_eq!(admins, self.admins);
        assert_eq!(lapsed, self.lapsed);
        assert_eq!(suspended, self.suspended);
        assert_eq!(members_with_display_names, self.members_with_display_names);
        assert_eq!(members_with_referrals, self.members_with_referrals);
    }
}

impl Members for CommunityMembers {
    type Member = CommunityMemberInternal;

    fn get(&self, user_id: &UserId) -> Option<CommunityMemberInternal> {
        self.get_by_user_id(user_id)
    }

    fn can_member_lapse(&self, user_id: &UserId) -> bool {
        self.members_and_channels.contains_key(user_id) && !self.owners.contains(user_id) && !self.lapsed.contains(user_id)
    }

    fn iter_members_who_can_lapse(&self) -> Box<dyn Iterator<Item = UserId> + '_> {
        Box::new(
            self.iter_member_ids()
                .filter(|id| !self.owners.contains(id) && !self.lapsed.contains(id)),
        )
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CommunityMemberInternal {
    #[serde(rename = "u")]
    pub user_id: UserId,
    #[serde(rename = "d")]
    pub date_added: TimestampMillis,
    #[serde(rename = "r", default, skip_serializing_if = "is_default")]
    role: CommunityRole,
    #[serde(rename = "ra", skip_serializing_if = "Option::is_none")]
    pub rules_accepted: Option<Timestamped<Version>>,
    #[serde(rename = "ut", default, skip_serializing_if = "is_default")]
    pub user_type: UserType,
    #[serde(rename = "dn", default, skip_serializing_if = "is_default")]
    display_name: Timestamped<Option<String>>,
    #[serde(rename = "rb", skip_serializing_if = "Option::is_none")]
    pub referred_by: Option<UserId>,
    #[serde(rename = "rf", default, skip_serializing_if = "BTreeSet::is_empty")]
    referrals: BTreeSet<UserId>,
    #[serde(rename = "rr", default, skip_serializing_if = "BTreeSet::is_empty")]
    referrals_removed: BTreeSet<UserId>,
    #[serde(rename = "l", default, skip_serializing_if = "is_default")]
    lapsed: Timestamped<bool>,
    #[serde(rename = "s", default, skip_serializing_if = "is_default")]
    suspended: Timestamped<bool>,
}

impl CommunityMemberInternal {
    pub fn accept_rules(&mut self, version: Version, now: TimestampMillis) -> bool {
        let already_accepted = self.rules_accepted.as_ref().is_some_and(|accepted| version <= accepted.value);

        if !already_accepted {
            self.rules_accepted = Some(Timestamped::new(version, now));
            true
        } else {
            false
        }
    }

    pub fn last_updated(&self) -> TimestampMillis {
        [
            self.date_added,
            self.suspended.timestamp,
            self.rules_accepted.as_ref().map(|r| r.timestamp).unwrap_or_default(),
            self.display_name.timestamp,
            self.lapsed.timestamp,
        ]
        .into_iter()
        .max()
        .unwrap()
    }

    pub fn role(&self) -> CommunityRole {
        self.role
    }

    pub fn display_name(&self) -> &Timestamped<Option<String>> {
        &self.display_name
    }

    pub fn referrals(&self) -> &BTreeSet<UserId> {
        &self.referrals
    }

    pub fn referrals_removed(&self) -> &BTreeSet<UserId> {
        &self.referrals_removed
    }

    pub fn lapsed(&self) -> &Timestamped<bool> {
        &self.lapsed
    }

    pub fn suspended(&self) -> &Timestamped<bool> {
        &self.suspended
    }

    pub fn add_referral(&mut self, user_id: UserId) {
        self.referrals.insert(user_id);
        self.referrals_removed.remove(&user_id);
    }

    pub fn remove_referral(&mut self, user_id: UserId) {
        if self.referrals.remove(&user_id) {
            self.referrals_removed.insert(user_id);
        }
    }
}

impl Member for CommunityMemberInternal {
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

#[allow(clippy::large_enum_variant)]
pub enum AddResult {
    Success(CommunityMemberInternal),
    AlreadyInCommunity,
    Blocked,
}

pub enum ChangeRoleResult {
    Success(ChangeRoleSuccessResult),
    UserNotInCommunity,
    NotAuthorized,
    TargetUserNotInCommunity,
    Unchanged,
    Invalid,
    UserSuspended,
}

pub struct ChangeRoleSuccessResult {
    pub caller_id: UserId,
    pub prev_role: CommunityRole,
}

impl From<CommunityMemberInternal> for CommunityMember {
    fn from(m: CommunityMemberInternal) -> Self {
        CommunityMember {
            user_id: m.user_id,
            date_added: m.date_added,
            role: m.role,
            display_name: m.display_name.value,
            referred_by: m.referred_by,
            lapsed: m.lapsed.value,
        }
    }
}

impl From<&CommunityMemberInternal> for CommunityMember {
    fn from(m: &CommunityMemberInternal) -> Self {
        CommunityMember {
            user_id: m.user_id,
            date_added: m.date_added,
            role: m.role,
            display_name: m.display_name.value.clone(),
            referred_by: m.referred_by,
            lapsed: m.lapsed.value,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use ic_stable_structures::DefaultMemoryImpl;
    use test_case::test_case;
    use types::CanisterId;

    #[test_case(true)]
    #[test_case(false)]
    fn channel_link_sets_maintained_correctly(channels_deleted: bool) {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init(memory.get(MemoryId::new(1)));

        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);
        let user_id1 = principal1.into();
        let user_id2 = principal2.into();

        let mut members = CommunityMembers::new(principal1, user_id1, UserType::User, vec![1u32.into()], 0);

        members.add(user_id2, principal2, UserType::User, None, 0);

        for i in 1u32..100 {
            members.mark_member_joined_channel(user_id2, i.into());

            if i % 4 == 0 {
                members.mark_member_left_channel(user_id2, (i / 4).into(), channels_deleted, 0);
            }
        }

        let channel_ids = members.channels_for_member(user_id2).to_vec();
        assert_eq!(channel_ids, (25u32..100).map(ChannelId::from).collect::<Vec<_>>());

        let removed: Vec<_> = members.channels_removed_for_member(user_id2).map(|(c, _)| c).collect();
        if channels_deleted {
            assert!(removed.is_empty());
        } else {
            assert_eq!(removed, (1u32..25).map(ChannelId::from).collect::<Vec<_>>());
        }

        members.remove(user_id2, Some(principal2), 0);
        assert!(members.channels_for_member(user_id2).is_empty());
        assert!(members.channels_removed_for_member(user_id2).next().is_none());
    }

    #[test]
    fn serialize_member_with_max_defaults() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init(memory.get(MemoryId::new(1)));

        #[derive(Serialize, Deserialize, Clone)]
        pub struct CommunityMemberInternal2 {
            #[serde(rename = "u")]
            pub user_id: UserId,
            #[serde(rename = "d")]
            pub date_added: TimestampMillis,
        }

        let member1 = CommunityMemberInternal {
            user_id: CanisterId::from_text("4bkt6-4aaaa-aaaaf-aaaiq-cai").unwrap().into(),
            date_added: 1732874138000,
            role: CommunityRole::Member,
            rules_accepted: None,
            user_type: UserType::User,
            display_name: Timestamped::default(),
            referred_by: None,
            referrals: BTreeSet::new(),
            referrals_removed: BTreeSet::new(),
            lapsed: Timestamped::default(),
            suspended: Timestamped::default(),
        };

        let member2 = CommunityMemberInternal2 {
            user_id: member1.user_id,
            date_added: member1.date_added,
        };

        let bytes1 = msgpack::serialize_then_unwrap(&member1);
        let bytes2 = msgpack::serialize_then_unwrap(&member2);

        assert_eq!(bytes1, bytes2);
        assert_eq!(bytes1.len(), 26);
    }
}
