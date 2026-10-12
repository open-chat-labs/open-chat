use crate::model::members::stable_memory::MembersStableStorage;
use crate::model::user_groups::{UserGroup, UserGroups};
use constants::calculate_summary_updates_data_removal_cutoff;
use group_community_common::{FormerMembers, Member, MemberUpdate, Members, MembersPage, Unlapsing, members_page};
use ic_principal::Principal;
use oc_error_codes::OCErrorCode;
use principal_to_user_id_map::PrincipalToUserIdMap;
use rand::Rng;
use serde::{Deserialize, Serialize};
use stable_memory_map::StableMemoryMap;
use std::collections::btree_map::Entry::Vacant;
use std::collections::{BTreeMap, BTreeSet};
use std::ops::Bound;
use types::{
    ChannelId, CommunityMember, CommunityPermissions, CommunityRole, OCResult, PushIfNotContains, TimestampMillis, Timestamped,
    UserId, UserIdAndPrincipal, UserType, Version, is_default,
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
    // Also holds the former members of any groups imported into the community who are not in it, since the
    // imported channels' events refer to them too
    #[serde(default)]
    former_members: FormerMembers,
    #[serde(default)]
    unlapsing: Option<Unlapsing>,
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
            principal: creator_principal,
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
            former_members: FormerMembers::default(),
            unlapsing: None,
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
                principal,
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
            if user_type.is_bot() {
                self.bots.insert(user_id, user_type);
            }
            self.former_members.on_member_added(user_id);
            self.prune_then_insert_member_update(user_id, MemberUpdate::Added, now);

            if let Some(referrer) = referred_by
                && matches!(
                    self.update_member(&referrer, |m| {
                        m.add_referral(user_id);
                        true
                    }),
                    Some(true)
                )
            {
                self.members_with_referrals.insert(referrer);
            }
            AddResult::Success(Box::new(member))
        } else {
            AddResult::AlreadyInCommunity
        }
    }

    pub fn add_user_id(&mut self, principal: Principal, user_id: UserId) {
        self.principal_to_user_id_map.insert(principal, user_id);
    }

    pub fn remove_by_principal(&mut self, principal: Principal, now: TimestampMillis) -> Option<CommunityMemberInternal> {
        let user_id = self.principal_to_user_id_map.remove(&principal)?.into_value();
        self.remove(user_id, Some(principal), false, now)
    }

    pub fn remove(
        &mut self,
        user_id: UserId,
        principal: Option<Principal>,
        user_deleted: bool,
        now: TimestampMillis,
    ) -> Option<CommunityMemberInternal> {
        self.remove_internal(user_id, principal, user_deleted, true, now)
    }

    fn remove_internal(
        &mut self,
        user_id: UserId,
        principal: Option<Principal>,
        user_deleted: bool,
        record_update: bool,
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
        if record_update {
            self.prune_then_insert_member_update(user_id, MemberUpdate::Removed, now);
        }
        self.former_members.on_member_removed(user_id, user_deleted);

        Some(member)
    }

    pub fn change_role(
        &mut self,
        user_id: UserId,
        target_user_id: UserId,
        new_role: CommunityRole,
        permissions: &CommunityPermissions,
        now: TimestampMillis,
    ) -> OCResult<ChangeRoleSuccess> {
        // Is the caller authorized to change the user to this role
        let initiator = self.get_verified_member(user_id.as_principal())?;

        if !initiator.role.can_change_roles(new_role, permissions) {
            return Err(OCErrorCode::InitiatorNotAuthorized.into());
        }

        let mut result: OCResult<CommunityRole> = Err(OCErrorCode::TargetUserNotInCommunity.into());
        let mut unlapsed = false;

        // The member is validated and updated within a single lookup in stable memory
        self.members_map.update(&target_user_id, |member| {
            // The initiator must be the same or senior to the target's current role, otherwise eg. an
            // admin could demote an owner
            if !initiator.role.is_same_or_senior(member.role) {
                result = Err(OCErrorCode::InitiatorNotAuthorized.into());
                return false;
            }

            // It is not possible to change the role of the last owner
            if member.role.is_owner() && self.owners.len() <= 1 {
                result = Err(OCErrorCode::CannotChangeRoleOfLastOwner.into());
                return false;
            }

            // It is not currently possible to make a bot an owner
            if member.user_type.is_3rd_party_bot() && new_role.is_owner() {
                result = Err(OCErrorCode::CannotMakeBotOwner.into());
                return false;
            }

            let prev_role = member.role;

            if prev_role == new_role {
                result = Err(OCErrorCode::NoChange.into());
                return false;
            }

            member.role = new_role;

            // Owners can't be lapsed
            if new_role.is_owner() && member.lapsed.value {
                member.lapsed = Timestamped::new(false, now);
                unlapsed = true;
            }

            result = Ok(prev_role);
            true
        });

        let prev_role = result?;

        match prev_role {
            CommunityRole::Owner => self.owners.remove(&target_user_id),
            CommunityRole::Admin => self.admins.remove(&target_user_id),
            _ => false,
        };

        if unlapsed {
            self.lapsed.remove(&target_user_id);
        }

        match new_role {
            CommunityRole::Owner => self.owners.insert(target_user_id),
            CommunityRole::Admin => self.admins.insert(target_user_id),
            _ => false,
        };

        self.prune_then_insert_member_update(target_user_id, MemberUpdate::RoleChanged, now);

        Ok(ChangeRoleSuccess { prev_role })
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

    pub fn create_user_group<R: Rng>(
        &mut self,
        name: String,
        mut users: Vec<UserId>,
        rng: &mut R,
        now: TimestampMillis,
    ) -> OCResult<u32> {
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
    ) -> OCResult {
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

    // Moves the membership, block and former membership of a user migrated to a MultiUser canister
    // onto their new id, along with their channels, user groups and referrals. `principal` is the
    // user's principal, if known, which is pointed at their new id if it points at the old one, as
    // it does for an invited user. Returns whether anything changed.
    pub fn migrate_user_id(
        &mut self,
        old_user_id: UserId,
        new_user_id: UserId,
        principal: Option<Principal>,
        now: TimestampMillis,
    ) -> bool {
        if old_user_id == new_user_id {
            return false;
        }

        let mut updated = false;
        if self.members_and_channels.contains_key(&old_user_id) {
            if self.blocked.contains(&new_user_id) {
                // The user has been blocked under their new id, so their membership under the old id
                // is dropped
                let principal = self.principal_if_mapped_to(&old_user_id);
                self.remove(old_user_id, principal, false, now);
            } else {
                // If the user has also joined under their new id since being migrated, that membership
                // is replaced by their membership under the old id, which holds their role, referrals,
                // etc, keeping the channels they have joined since. No update is recorded for its
                // removal, since the user remains a member and clients are told of them being added
                // under their new id.
                let new_channels = self.members_and_channels.get(&new_user_id).cloned().unwrap_or_default();
                self.remove_internal(new_user_id, None, false, false, now);
                let member = self.members_map.remove(&old_user_id).unwrap().into_value();
                self.move_member(member, new_user_id, now);
                for channel_id in new_channels {
                    self.mark_member_joined_channel(new_user_id, channel_id);
                }
            }
            updated = true;
        }

        if let Some(principal) = principal
            && self.principal_to_user_id_map.get(&principal) == Some(old_user_id)
        {
            self.principal_to_user_id_map.insert(principal, new_user_id);
            updated = true;
        }
        let is_member = self.members_and_channels.contains_key(&new_user_id);
        if self.unblock(old_user_id, now) {
            if !is_member {
                self.block(new_user_id, now);
            }
            updated = true;
        }
        updated |= self.former_members.migrate_user_id(old_user_id, new_user_id, is_member);
        updated
    }

    fn principal_if_mapped_to(&self, user_id: &UserId) -> Option<Principal> {
        self.members_map
            .get(user_id)
            .map(|m| m.principal)
            .filter(|p| self.principal_to_user_id_map.get(p) == Some(*user_id))
    }

    // Moves a member, who has already been removed from `members_map`, onto their new id
    fn move_member(&mut self, mut member: CommunityMemberInternal, new_user_id: UserId, now: TimestampMillis) {
        let old_user_id = member.user_id;
        member.user_id = new_user_id;

        if self.principal_to_user_id_map.get(&member.principal) == Some(old_user_id) {
            self.principal_to_user_id_map.insert(member.principal, new_user_id);
        }

        let channels = self.members_and_channels.remove(&old_user_id).unwrap_or_default();
        self.members_and_channels.insert(new_user_id, channels);
        let channels_removed: Vec<_> = self.channels_removed_for_member(old_user_id).collect();
        for (channel_id, timestamp) in channels_removed {
            self.member_channel_links_removed.remove(&(old_user_id, channel_id));
            self.member_channel_links_removed.insert((new_user_id, channel_id), timestamp);
        }
        self.user_groups.migrate_user_id(old_user_id, new_user_id, now);

        for set in [
            &mut self.owners,
            &mut self.admins,
            &mut self.lapsed,
            &mut self.suspended,
            &mut self.members_with_display_names,
            &mut self.members_with_referrals,
        ] {
            if set.remove(&old_user_id) {
                set.insert(new_user_id);
            }
        }
        if self.lapsed.contains(&new_user_id) {
            self.restart_unlapsing_cursor();
        }
        if let Some(user_type) = self.bots.remove(&old_user_id) {
            self.bots.insert(new_user_id, user_type);
        }

        if let Some(referrer) = member.referred_by {
            self.update_member(&referrer, |m| {
                if m.referrals.contains(&old_user_id) {
                    // Recorded as a removal so that the referrer's client is told of it
                    m.remove_referral(old_user_id);
                    m.add_referral(new_user_id);
                    true
                } else {
                    false
                }
            });
        }
        for referred in member.referrals.iter() {
            self.update_member(referred, |m| {
                m.referred_by = Some(new_user_id);
                true
            });
        }

        self.members_map.insert(new_user_id, member);
        self.former_members.on_member_added(new_user_id);
        self.prune_then_insert_member_update(old_user_id, MemberUpdate::Removed, now);
        self.prune_then_insert_member_update(new_user_id, MemberUpdate::Added, now);
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
        let user_id = self
            .principal_to_user_id_map
            .get(&user_id_or_principal)
            .unwrap_or(user_id_or_principal.into());

        self.members_map.get(&user_id)
    }

    pub fn get_verified_member(&self, user_id_or_principal: Principal) -> Result<CommunityMemberInternal, OCErrorCode> {
        let member = self.get(user_id_or_principal).ok_or(OCErrorCode::InitiatorNotInChat)?;
        member.verify()?;
        Ok(member)
    }

    pub fn get_by_user_id(&self, user_id: &UserId) -> Option<CommunityMemberInternal> {
        self.members_map.get(user_id)
    }

    pub fn contains(&self, user_id: &UserId) -> bool {
        self.members_and_channels.contains_key(user_id)
    }

    // A page of the members in order of user id, starting from the first after `after`, and holding
    // up to `max_results` of them, or all of them if `max_results` is None. The owners and admins
    // are instead all returned with the first page (where `after` is None). See `members_page`.
    pub fn page(&self, after: Option<UserId>, max_results: Option<u32>) -> MembersPage<CommunityMember> {
        let start = after.map_or(Bound::Unbounded, Bound::Excluded);
        members_page(
            &[&self.owners, &self.admins],
            self.members_and_channels
                .range((start, Bound::Unbounded))
                .map(|(user_id, _)| user_id),
            after.is_none(),
            max_results,
            |user_id| {
                !self.lapsed.contains(user_id)
                    && !self.suspended.contains(user_id)
                    && !self.members_with_display_names.contains(user_id)
                    && !self.members_with_referrals.contains(user_id)
            },
            |user_id| self.members_map.get(user_id).map(CommunityMember::from),
        )
    }

    // Up to `max_results` of the members whose display names contain `term` (ignoring case). Those
    // whose display names start with it come first, then each shortest first, then in order of
    // display name. `keep_going` is asked before each member with a display name is read, so that
    // the search can be cut short, in which case the matches found so far are returned.
    pub fn search_display_names(
        &self,
        term: &str,
        max_results: usize,
        mut keep_going: impl FnMut() -> bool,
    ) -> Vec<CommunityMember> {
        let term = term.trim().to_uppercase();
        // Display names are at most 25 characters, which in upper case can be up to 3 times as many,
        // so a longer term can't match any. Comparing one with every display name would be costly.
        if term.is_empty() || term.chars().count() > 75 {
            return Vec::new();
        }

        let mut matches = Vec::new();
        for user_id in self.members_with_display_names.iter() {
            if !keep_going() {
                break;
            }
            if let Some(member) = self.members_map.get(user_id)
                && let Some(display_name) = member.display_name().value.as_deref()
            {
                let display_name = display_name.to_uppercase();
                if let Some(position) = display_name.find(&term) {
                    matches.push((position > 0, display_name.chars().count(), display_name, member));
                }
            }
        }

        matches.sort_unstable_by(|(c1, l1, n1, m1), (c2, l2, n2, m2)| {
            c1.cmp(c2)
                .then(l1.cmp(l2))
                .then_with(|| n1.cmp(n2))
                .then(m1.user_id.cmp(&m2.user_id))
        });

        matches
            .into_iter()
            .take(max_results)
            .map(|(_, _, _, member)| CommunityMember::from(member))
            .collect()
    }

    pub fn is_former_member(&self, user_id: &UserId) -> bool {
        self.former_members.contains(user_id)
    }

    // Skips any who are members, since they are not former members
    pub fn add_former_members(&mut self, user_ids: impl IntoIterator<Item = UserId>) {
        for user_id in user_ids {
            if !self.members_and_channels.contains_key(&user_id) {
                self.former_members.record(user_id);
            }
        }
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

    pub fn member_ids(&self) -> impl Iterator<Item = &UserId> {
        self.members_and_channels.keys()
    }

    pub fn role(&self, user_id: &UserId) -> Option<CommunityRole> {
        if self.owners.contains(user_id) {
            Some(CommunityRole::Owner)
        } else if self.admins.contains(user_id) {
            Some(CommunityRole::Admin)
        } else if self.members_and_channels.contains_key(user_id) {
            Some(CommunityRole::Member)
        } else {
            None
        }
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

    // Starts unlapsing the members who have lapsed up to now, as is done once there is no longer an
    // access gate (see `unlapse_while`). If unlapsing is already under way it starts again, so that
    // it covers those who have lapsed since it started too.
    pub fn start_unlapsing(&mut self, now: TimestampMillis) {
        self.unlapsing = Some(Unlapsing {
            before: now,
            after: None,
        });
    }

    pub fn is_unlapsing(&self) -> bool {
        self.unlapsing.is_some()
    }

    // Unlapses, in order of user id, the members who lapsed before `start_unlapsing` was called,
    // until `keep_going` returns false or there are none left. Each is written to stable memory, so
    // a great many are unlapsed a batch at a time (see the `unlapse_members` job). Members who have
    // lapsed since, under an access gate set since, are left lapsed. Returns those unlapsed.
    pub fn unlapse_while(&mut self, now: TimestampMillis, mut keep_going: impl FnMut() -> bool) -> Vec<UserId> {
        let Some(Unlapsing { before, mut after }) = self.unlapsing else {
            return Vec::new();
        };
        self.prune_member_updates(now);
        let mut unlapsed = Vec::new();
        loop {
            if !keep_going() {
                self.unlapsing = Some(Unlapsing { before, after });
                return unlapsed;
            }
            let start = after.map_or(Bound::Unbounded, Bound::Excluded);
            let Some(user_id) = self.lapsed.range((start, Bound::Unbounded)).next().copied() else {
                self.unlapsing = None;
                return unlapsed;
            };
            after = Some(user_id);

            let mut not_lapsed = false;
            let updated = self.update_member(&user_id, |m| {
                not_lapsed = !m.lapsed.value;
                m.lapsed.timestamp <= before && m.set_lapsed(false, now)
            });
            match updated {
                Some(true) => {
                    self.lapsed.remove(&user_id);
                    self.updates.insert((now, user_id, MemberUpdate::Unlapsed));
                    unlapsed.push(user_id);
                }
                // A member whose record says they aren't lapsed, or who isn't a member, shouldn't be
                // in the set (eg. if the members were imported from a group which was unlapsing them)
                Some(false) if not_lapsed => {
                    self.lapsed.remove(&user_id);
                }
                None => {
                    self.lapsed.remove(&user_id);
                }
                Some(false) => {}
            }
        }
    }

    // A member who has been migrated to a new user id may now come before the cursor, so the lapsed
    // members are looked at again from the start. Those already unlapsed are no longer among them.
    fn restart_unlapsing_cursor(&mut self) {
        if let Some(unlapsing) = self.unlapsing.as_mut() {
            unlapsing.after = None;
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
        // `update_fn` comes from the caller and could read anything, including another value in the
        // stable memory map, so the member is read and written in 2 separate lookups rather than
        // via `StableMemoryMap::update`, which would hold the map borrowed while `update_fn` runs
        let mut member = self.members_map.get(user_id)?;

        let updated = update_fn(&mut member);
        if updated {
            self.members_map.insert(member.user_id, member);
        }
        Some(updated)
    }

    // Whether any update made after `since` has been pruned, so that `iter_latest_updates(since)`
    // doesn't return them all
    pub fn any_updates_removed(&self, since: TimestampMillis) -> bool {
        self.latest_update_removed > since
    }

    // Whether more than `limit` updates have been made after `since`. At most `limit + 1` of them are
    // read, so this is cheap however many there are.
    pub fn more_updates_since_than(&self, since: TimestampMillis, limit: u32) -> bool {
        self.iter_latest_updates(since).nth(limit as usize).is_some()
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
        let mut bots = BTreeMap::new();

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

            if member.user_type.is_bot() {
                bots.insert(member.user_id, member.user_type);
            }
        }

        assert_eq!(member_ids, self.members_and_channels.keys().copied().collect::<BTreeSet<_>>());
        assert_eq!(owners, self.owners);
        assert_eq!(admins, self.admins);
        assert_eq!(lapsed, self.lapsed);
        assert_eq!(suspended, self.suspended);
        assert_eq!(members_with_display_names, self.members_with_display_names);
        assert_eq!(members_with_referrals, self.members_with_referrals);
        assert_eq!(bots, self.bots);
        assert!(self.former_members.iter().all(|u| !member_ids.contains(&u)));
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
    #[serde(rename = "p")]
    pub principal: Principal,
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
    // The member and their principal
    pub fn user(&self) -> UserIdAndPrincipal {
        UserIdAndPrincipal::new(self.user_id, self.principal)
    }

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

    pub fn verify(&self) -> Result<(), OCErrorCode> {
        if self.suspended.value {
            Err(OCErrorCode::InitiatorSuspended)
        } else if self.lapsed.value {
            Err(OCErrorCode::InitiatorLapsed)
        } else {
            Ok(())
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

pub enum AddResult {
    Success(Box<CommunityMemberInternal>),
    AlreadyInCommunity,
    Blocked,
}

pub struct ChangeRoleSuccess {
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
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use std::collections::HashMap;
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

        members.remove(user_id2, Some(principal2), false, 0);
        assert!(members.channels_for_member(user_id2).is_empty());
        assert!(members.channels_removed_for_member(user_id2).next().is_none());
    }

    #[test]
    fn bots_recorded_when_added() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init(memory.get(MemoryId::new(1)));

        let user_id = test_user_id;
        let principal = |i: u8| test_principal(test_user_id(i));
        let expected = BTreeMap::from([(user_id(2), UserType::OcControlledBot)]);

        let mut members = CommunityMembers::new(principal(1), user_id(1), UserType::User, Vec::new(), 0);
        members.add(user_id(2), principal(2), UserType::OcControlledBot, None, 0);
        members.add(user_id(3), principal(3), UserType::User, None, 0);
        assert_eq!(members.bots(), &expected);
        members.check_invariants();

        members.remove(user_id(2), None, false, 0);
        assert!(members.bots().is_empty());
        members.check_invariants();
    }

    #[test]
    fn former_members_maintained_correctly() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init(memory.get(MemoryId::new(1)));

        let user_id = test_user_id;
        let principal = |i: u8| test_principal(test_user_id(i));

        let mut members = CommunityMembers::new(principal(1), user_id(1), UserType::User, Vec::new(), 0);
        members.add(user_id(2), principal(2), UserType::User, None, 0);
        members.add(user_id(3), principal(3), UserType::User, None, 0);

        members.remove(user_id(2), None, false, 0);
        members.remove(user_id(3), None, true, 0);
        members.add_former_members([user_id(1), user_id(4)]);

        assert!(members.is_former_member(&user_id(2)));
        assert!(!members.is_former_member(&user_id(3)), "deleted users aren't recorded");
        assert!(!members.is_former_member(&user_id(1)), "members are skipped");
        assert!(members.is_former_member(&user_id(4)));

        members.add(user_id(2), principal(2), UserType::User, None, 0);
        members.add(user_id(4), principal(4), UserType::User, None, 0);

        assert!(!members.is_former_member(&user_id(2)));
        assert!(!members.is_former_member(&user_id(4)));
        members.check_invariants();
    }

    #[test]
    fn migrate_user_id_moves_membership_block_and_former_membership() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init(memory.get(MemoryId::new(1)));

        let [
            creator,
            referrer,
            old,
            new,
            referred,
            blocked_old,
            blocked_new,
            former_old,
            former_new,
        ]: [UserId; 9] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(test_user_id);
        let (channel1, channel2) = (ChannelId::from(1u32), ChannelId::from(2u32));

        let mut members = CommunityMembers::new(test_principal(creator), creator, UserType::User, Vec::new(), 0);
        members.add(referrer, test_principal(referrer), UserType::User, None, 1);
        members.add(old, test_principal(old), UserType::User, Some(referrer), 2);
        members.add(referred, test_principal(referred), UserType::User, Some(old), 3);
        members.add(former_old, test_principal(former_old), UserType::User, None, 3);
        members.remove(former_old, Some(test_principal(former_old)), false, 4);
        members.block(blocked_old, 4);
        members.set_display_name(old, Some("old".to_string()), 5);
        members.set_suspended(old, true, 5);
        members.mark_member_joined_channel(old, channel1);
        members.mark_member_joined_channel(old, channel2);
        members.mark_member_left_channel(old, channel2, false, 6);
        let user_group_id = members
            .create_user_group("group".to_string(), vec![old, referred], &mut rand::rng(), 6)
            .unwrap();

        assert!(members.migrate_user_id(old, new, None, 10));
        assert!(!members.contains(&old));
        assert!(members.get_by_user_id(&old).is_none());
        let member = members.get_by_user_id(&new).unwrap();
        assert_eq!(member.user_id, new);
        assert_eq!(member.principal, test_principal(old));
        assert_eq!(member.date_added, 2);
        assert_eq!(member.referred_by, Some(referrer));
        assert_eq!(member.referrals(), &[referred].into_iter().collect());
        assert_eq!(member.display_name().value.as_deref(), Some("old"));
        assert!(member.suspended().value);
        assert_eq!(members.lookup_user_id(test_principal(old)), Some(new));
        assert_eq!(members.get(test_principal(old)).unwrap().user_id, new);
        assert_eq!(members.channels_for_member(new), &[channel1]);
        assert_eq!(
            members.channels_removed_for_member(new).collect::<Vec<_>>(),
            vec![(channel2, 6)]
        );
        assert!(members.channels_removed_for_member(old).next().is_none());
        assert_eq!(
            members.get_user_group(user_group_id).unwrap().members.value,
            [new, referred].into_iter().collect()
        );
        let referrer_member = members.get_by_user_id(&referrer).unwrap();
        assert_eq!(referrer_member.referrals(), &[new].into_iter().collect());
        // So that the referrer's client is told the referral under the old id has gone
        assert!(referrer_member.referrals_removed().contains(&old));
        assert_eq!(members.get_by_user_id(&referred).unwrap().referred_by, Some(new));
        assert!(members.suspended.contains(&new));
        assert!(members.members_with_display_names.contains(&new));
        assert!(members.members_with_referrals.contains(&new));

        assert!(members.migrate_user_id(blocked_old, blocked_new, None, 10));
        assert!(!members.is_blocked(&blocked_old));
        assert!(members.is_blocked(&blocked_new));

        assert!(members.migrate_user_id(former_old, former_new, None, 10));
        assert!(!members.is_former_member(&former_old));
        assert!(members.is_former_member(&former_new));

        // Clients are told of each change
        let updates: Vec<_> = members.iter_latest_updates(9).collect();
        for update in [
            (old, MemberUpdate::Removed),
            (new, MemberUpdate::Added),
            (blocked_old, MemberUpdate::Unblocked),
            (blocked_new, MemberUpdate::Blocked),
        ] {
            assert!(updates.contains(&update));
        }

        // Nothing is left under the old ids
        for (old, new) in [(old, new), (blocked_old, blocked_new), (former_old, former_new)] {
            assert!(!members.migrate_user_id(old, new, None, 11));
        }
        members.check_invariants();
    }

    #[test]
    fn migrate_user_id_keeps_old_membership_if_also_member_under_new_id() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init(memory.get(MemoryId::new(1)));

        let [creator, old, new]: [UserId; 3] = [1, 2, 3].map(test_user_id);
        let (channel1, channel2) = (ChannelId::from(1u32), ChannelId::from(2u32));
        // The user keeps the same principal when migrated
        let principal = test_principal(old);
        let mut members = CommunityMembers::new(test_principal(creator), creator, UserType::User, Vec::new(), 0);
        members.add(old, principal, UserType::User, None, 1);
        members.mark_member_joined_channel(old, channel1);
        members.add(new, principal, UserType::User, None, 2);
        members.mark_member_joined_channel(new, channel2);

        assert!(members.migrate_user_id(old, new, None, 10));
        assert!(!members.contains(&old));
        assert_eq!(members.get_by_user_id(&new).unwrap().date_added, 1);
        assert_eq!(members.channels_for_member(new), &[channel1, channel2]);
        assert_eq!(members.lookup_user_id(principal), Some(new));
        assert!(!members.is_former_member(&old));
        assert!(!members.is_former_member(&new));

        // Clients are told the user was added under their new id, not removed
        let mut latest = HashMap::new();
        for (user_id, update) in members.iter_latest_updates(9) {
            latest.entry(user_id).or_insert(update);
        }
        assert_eq!(latest.get(&new), Some(&MemberUpdate::Added));
        members.check_invariants();
    }

    #[test]
    fn migrate_user_id_drops_old_membership_if_blocked_under_new_id() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init(memory.get(MemoryId::new(1)));

        let [creator, old, new]: [UserId; 3] = [1, 2, 3].map(test_user_id);
        let mut members = CommunityMembers::new(test_principal(creator), creator, UserType::User, Vec::new(), 0);
        members.add(old, test_principal(old), UserType::User, None, 1);
        members.block(new, 5);

        assert!(members.migrate_user_id(old, new, None, 10));
        assert!(!members.contains(&old));
        assert!(!members.contains(&new));
        assert!(members.is_blocked(&new));
        assert_eq!(members.lookup_user_id(test_principal(old)), None);
        members.check_invariants();
    }

    #[test]
    fn migrate_user_id_points_an_invited_users_principal_at_their_new_id() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init(memory.get(MemoryId::new(1)));

        let [creator, old, new]: [UserId; 3] = [1, 2, 3].map(test_user_id);
        let principal = test_principal(old);
        let mut members = CommunityMembers::new(test_principal(creator), creator, UserType::User, Vec::new(), 0);
        members.add_user_id(principal, old);

        // Without the principal, an invited user's lookup can't be found
        assert!(!members.migrate_user_id(old, new, None, 10));
        assert_eq!(members.lookup_user_id(principal), Some(old));

        assert!(members.migrate_user_id(old, new, Some(principal), 10));
        assert_eq!(members.lookup_user_id(principal), Some(new));
    }

    #[test]
    fn pages_hold_each_member_once_with_those_with_roles_in_the_first() {
        let mut members = members_for_page_tests(9);
        make_admin(&mut members, 8);
        members.update_lapsed(test_user_id(3), true, 3);
        members.set_display_name(test_user_id(5), Some("five".to_string()), 3);

        // The owner and admin, then the others in order of user id, of whom the lapsed member and
        // the member with a display name are returned in full
        let page1 = members.page(None, Some(4));
        assert_eq!(member_ids(&page1.members), user_ids([1, 8, 3, 5]));
        assert_eq!(page1.members[3].display_name.as_deref(), Some("five"));
        assert_eq!(page1.basic_members, user_ids([2, 4]));
        assert_eq!(page1.more_members_after, Some(test_user_id(5)));

        let page2 = members.page(page1.more_members_after, Some(4));
        assert!(page2.members.is_empty());
        assert_eq!(page2.basic_members, user_ids([6, 7, 9]));
        assert_eq!(page2.more_members_after, None);

        let all = members.page(None, None);
        assert_eq!(member_ids(&all.members), user_ids([1, 8, 3, 5]));
        assert_eq!(all.basic_members, user_ids([2, 4, 6, 7, 9]));
        assert_eq!(all.more_members_after, None);
    }

    #[test]
    fn display_names_are_searched_best_matches_first() {
        let mut members = members_for_page_tests(7);
        members.set_display_name(test_user_id(2), Some("Bobby".to_string()), 1);
        members.set_display_name(test_user_id(3), Some("Jimbob".to_string()), 1);
        members.set_display_name(test_user_id(4), Some("bob".to_string()), 1);
        members.set_display_name(test_user_id(5), Some("Alice".to_string()), 1);
        members.set_display_name(test_user_id(6), Some("Bobbi".to_string()), 1);
        // A display name which has been removed isn't searched
        members.set_display_name(test_user_id(7), Some("Bob Jr".to_string()), 1);
        members.set_display_name(test_user_id(7), None, 2);

        // Those starting with the term (ignoring case) come first, shortest first, then those
        // which only contain it
        let found = members.search_display_names(" BOB ", 10, || true);
        assert_eq!(member_ids(&found), user_ids([4, 6, 2, 3]));
        assert_eq!(found[0].display_name.as_deref(), Some("bob"));

        assert_eq!(member_ids(&members.search_display_names("bob", 2, || true)), user_ids([4, 6]));
        assert!(members.search_display_names("carol", 10, || true).is_empty());
        assert!(members.search_display_names("  ", 10, || true).is_empty());
        assert!(members.search_display_names(&"b".repeat(76), 10, || true).is_empty());
    }

    #[test]
    fn a_search_cut_short_returns_what_it_has_found() {
        let mut members = members_for_page_tests(4);
        for user in 2..=4 {
            members.set_display_name(test_user_id(user), Some(format!("name{user}")), 1);
        }

        let mut asked = 0;
        let found = members.search_display_names("name", 10, || {
            asked += 1;
            asked <= 2
        });

        assert_eq!(member_ids(&found), user_ids([2, 3]));
    }

    #[test]
    fn lapsed_members_are_unlapsed_until_told_to_stop() {
        let mut members = members_for_page_tests(5);
        for user in 2..=5 {
            members.update_lapsed(test_user_id(user), true, 3);
        }
        members.start_unlapsing(10);

        // Stopped after 2
        let mut asked = 0;
        let unlapsed = members.unlapse_while(10, || {
            asked += 1;
            asked <= 2
        });
        assert_eq!(unlapsed, user_ids([2, 3]));
        assert!(members.is_unlapsing());
        assert_eq!(members.lapsed().len(), 2);
        assert!(!members.get_by_user_id(&test_user_id(2)).unwrap().lapsed().value);
        assert!(members.get_by_user_id(&test_user_id(5)).unwrap().lapsed().value);

        // Then the rest
        assert_eq!(members.unlapse_while(11, || true), user_ids([4, 5]));
        assert!(!members.is_unlapsing());
        assert!(members.lapsed().is_empty());
        assert!((2..=5).all(|user| !members.get_by_user_id(&test_user_id(user)).unwrap().lapsed().value));
        // Each is in the updates, so that clients learn of it
        let unlapsed: Vec<_> = members
            .iter_latest_updates(3)
            .filter(|(_, update)| matches!(update, MemberUpdate::Unlapsed))
            .map(|(user_id, _)| user_id)
            .collect();
        assert_eq!(unlapsed.len(), 4);
    }

    #[test]
    fn a_lapsed_member_migrated_to_an_earlier_user_id_is_still_unlapsed() {
        let mut members = members_for_page_tests(5);
        members.update_lapsed(test_user_id(3), true, 3);
        members.update_lapsed(test_user_id(5), true, 3);
        members.start_unlapsing(10);

        let mut asked = 0;
        let unlapsed = members.unlapse_while(10, || {
            asked += 1;
            asked <= 1
        });
        assert_eq!(unlapsed, user_ids([3]));

        // User 5 is migrated to an id before where unlapsing has got to
        members.migrate_user_id(test_user_id(5), test_user_id(0), None, 11);
        assert_eq!(members.unlapse_while(12, || true), user_ids([0]));
        assert!(members.lapsed().is_empty());
        assert!(!members.get_by_user_id(&test_user_id(0)).unwrap().lapsed().value);
    }

    #[test]
    fn members_who_lapse_after_unlapsing_starts_are_left_lapsed() {
        let mut members = members_for_page_tests(4);
        members.update_lapsed(test_user_id(2), true, 3);
        members.update_lapsed(test_user_id(4), true, 3);
        members.start_unlapsing(10);

        let mut asked = 0;
        let unlapsed = members.unlapse_while(10, || {
            asked += 1;
            asked <= 1
        });
        assert_eq!(unlapsed, user_ids([2]));

        // User 3 lapses under an access gate set since the last was removed
        members.update_lapsed(test_user_id(3), true, 20);
        assert_eq!(members.unlapse_while(21, || true), user_ids([4]));
        assert!(!members.is_unlapsing());
        assert!(members.get_by_user_id(&test_user_id(3)).unwrap().lapsed().value);

        // Until that gate is removed too
        members.start_unlapsing(30);
        assert_eq!(members.unlapse_while(30, || true), user_ids([3]));
        assert!(members.lapsed().is_empty());
    }

    // Holds users 1 to `count`, of whom user 1 is the owner
    fn members_for_page_tests(count: u8) -> CommunityMembers {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init(memory.get(MemoryId::new(1)));

        let owner = test_user_id(1);
        let mut members = CommunityMembers::new(test_principal(owner), owner, UserType::User, Vec::new(), 0);
        for user_id in (2..=count).map(test_user_id) {
            members.add(user_id, test_principal(user_id), UserType::User, None, 1);
        }
        members
    }

    fn make_admin(members: &mut CommunityMembers, user: u8) {
        members
            .change_role(
                test_user_id(1),
                test_user_id(user),
                CommunityRole::Admin,
                &CommunityPermissions::default(),
                2,
            )
            .unwrap();
    }

    fn member_ids(members: &[CommunityMember]) -> Vec<UserId> {
        members.iter().map(|m| m.user_id).collect()
    }

    fn user_ids<const N: usize>(ids: [u8; N]) -> Vec<UserId> {
        ids.map(test_user_id).to_vec()
    }

    fn test_user_id(i: u8) -> UserId {
        Principal::from_slice(&[i]).into()
    }

    fn test_principal(user_id: UserId) -> Principal {
        Principal::from_slice(&[100 + user_id.as_slice()[0]])
    }

    #[test]
    fn serialize_member_with_max_defaults() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init(memory.get(MemoryId::new(1)));

        #[derive(Serialize, Deserialize, Clone)]
        pub struct CommunityMemberInternal2 {
            #[serde(rename = "u")]
            pub user_id: UserId,
            #[serde(rename = "p")]
            pub principal: Principal,
            #[serde(rename = "d")]
            pub date_added: TimestampMillis,
        }

        let member1 = CommunityMemberInternal {
            user_id: CanisterId::from_text("4bkt6-4aaaa-aaaaf-aaaiq-cai").unwrap().into(),
            principal: Principal::from_text("4bkt6-4aaaa-aaaaf-aaaiq-cai").unwrap(),
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
            principal: member1.principal,
            date_added: member1.date_added,
        };

        let bytes1 = msgpack::serialize_then_unwrap(&member1);
        let bytes2 = msgpack::serialize_then_unwrap(&member2);

        assert_eq!(bytes1, bytes2);
        assert_eq!(bytes1.len(), 40);
    }
}
