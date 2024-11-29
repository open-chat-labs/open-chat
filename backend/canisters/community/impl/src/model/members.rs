use crate::model::user_groups::{UserGroup, UserGroups};
use candid::Principal;
use group_community_common::{Member, MemberUpdate, Members};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::collections::btree_map::Entry::Vacant;
use std::collections::{BTreeMap, BTreeSet};
use types::{
    is_default, ChannelId, CommunityMember, CommunityPermissions, CommunityRole, TimestampMillis, Timestamped, UserId,
    UserType, Version,
};

#[cfg(test)]
mod proptests;

const MAX_MEMBERS_PER_COMMUNITY: u32 = 100_000;

#[derive(Serialize, Deserialize)]
pub struct CommunityMembers {
    members: BTreeMap<UserId, CommunityMemberInternal>,
    member_channel_links: BTreeSet<(UserId, ChannelId)>,
    member_channel_links_removed: BTreeMap<(UserId, ChannelId), TimestampMillis>,
    user_groups: UserGroups,
    // This includes the userIds of community members and also users invited to the community
    principal_to_user_id_map: BTreeMap<Principal, UserId>,
    member_ids: BTreeSet<UserId>,
    owners: BTreeSet<UserId>,
    admins: BTreeSet<UserId>,
    bots: BTreeMap<UserId, UserType>,
    blocked: BTreeSet<UserId>,
    lapsed: BTreeSet<UserId>,
    suspended: BTreeSet<UserId>,
    members_with_display_names: BTreeSet<UserId>,
    members_with_referrals: BTreeSet<UserId>,
    updates: BTreeSet<(TimestampMillis, UserId, MemberUpdate)>,
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
            lapsed: Timestamped::default(),
        };

        CommunityMembers {
            members: vec![(creator_user_id, member)].into_iter().collect(),
            member_channel_links: public_channels.into_iter().map(|c| (creator_user_id, c)).collect(),
            member_channel_links_removed: BTreeMap::new(),
            user_groups: UserGroups::default(),
            principal_to_user_id_map: vec![(creator_principal, creator_user_id)].into_iter().collect(),
            member_ids: [creator_user_id].into_iter().collect(),
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
        } else {
            match self.members.entry(user_id) {
                Vacant(e) => {
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
                        lapsed: Timestamped::default(),
                    };
                    e.insert(member.clone());
                    self.add_user_id(principal, user_id);

                    if let Some(referrer) = referred_by.and_then(|ref_id| self.get_by_user_id_mut(&ref_id)) {
                        referrer.referrals.insert(user_id);
                        let referrer_user_id = referrer.user_id;
                        self.members_with_referrals.insert(referrer_user_id);
                    }
                    self.member_ids.insert(user_id);

                    AddResult::Success(member)
                }
                _ => AddResult::AlreadyInCommunity,
            }
        }
    }

    pub fn add_user_id(&mut self, principal: Principal, user_id: UserId) {
        self.principal_to_user_id_map.insert(principal, user_id);
    }

    pub fn remove(&mut self, user_id: &UserId, now: TimestampMillis) -> Option<CommunityMemberInternal> {
        self.get_principal(user_id)
            .and_then(|principal| self.remove_by_principal(&principal, now))
    }

    pub fn remove_by_principal(&mut self, principal: &Principal, now: TimestampMillis) -> Option<CommunityMemberInternal> {
        if let Some(user_id) = self.principal_to_user_id_map.remove(principal) {
            if let Some(member) = self.members.remove(&user_id) {
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
                if let Some(referrer) = member.referred_by.and_then(|uid| self.get_by_user_id_mut(&uid)) {
                    referrer.referrals.remove(&user_id);
                    if referrer.referrals.is_empty() {
                        let referrer_user_id = referrer.user_id;
                        self.members_with_referrals.remove(&referrer_user_id);
                    }
                }
                let channel_ids: Vec<_> = self.channels_for_member(user_id).collect();
                for channel_id in channel_ids {
                    self.member_channel_links.remove(&(user_id, channel_id));
                }
                let channels_removed: Vec<_> = self.channels_removed_for_member(user_id).map(|(c, _)| c).collect();
                for channel_id in channels_removed {
                    self.member_channel_links_removed.remove(&(user_id, channel_id));
                }
                self.user_groups.remove_user_from_all(&member.user_id, now);
                self.member_ids.remove(&user_id);

                return Some(member);
            }
        }

        None
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

        let member = match self.members.get_mut(&target_user_id) {
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
                    self.update_lapsed(target_user_id, false, now);
                }
                self.owners.insert(target_user_id)
            }
            CommunityRole::Admin => self.admins.insert(target_user_id),
            _ => false,
        };

        ChangeRoleResult::Success(ChangeRoleSuccessResult {
            caller_id: user_id,
            prev_role,
        })
    }

    pub fn set_suspended(&mut self, user_id: UserId, suspended: bool, now: TimestampMillis) -> Option<bool> {
        let member = self.members.get_mut(&user_id)?;

        if member.suspended.value != suspended {
            member.suspended = Timestamped::new(suspended, now);
            if suspended {
                self.suspended.insert(user_id);
            } else {
                self.suspended.remove(&user_id);
            }
            Some(true)
        } else {
            Some(false)
        }
    }

    pub fn create_user_group<R: RngCore>(
        &mut self,
        name: String,
        mut users: Vec<UserId>,
        rng: &mut R,
        now: TimestampMillis,
    ) -> Option<u32> {
        users.retain(|u| self.members.contains_key(u));

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
        users_to_add.retain(|u| self.members.contains_key(u));

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
        if let Some(user_id) = self.principal_to_user_id_map.remove(&old_principal) {
            self.principal_to_user_id_map.insert(new_principal, user_id);
        }
    }

    pub fn mark_member_joined_channel(&mut self, user_id: UserId, channel_id: ChannelId) {
        if self.member_ids.contains(&user_id) {
            self.member_channel_links.insert((user_id, channel_id));
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
        if self.member_ids.contains(&user_id) {
            self.member_channel_links.remove(&(user_id, channel_id));
            if !channel_deleted {
                self.member_channel_links_removed.insert((user_id, channel_id), now);
            }
        }
    }

    pub fn mark_rules_accepted(&mut self, user_id: &UserId, version: Version, now: TimestampMillis) {
        if let Some(member) = self.members.get_mut(user_id) {
            member.accept_rules(version, now);
        }
    }

    pub fn block(&mut self, user_id: UserId) -> bool {
        self.blocked.insert(user_id)
    }

    pub fn unblock(&mut self, user_id: &UserId) -> bool {
        self.blocked.remove(user_id)
    }

    pub fn user_limit_reached(&self) -> Option<u32> {
        if self.members.len() >= MAX_MEMBERS_PER_COMMUNITY as usize {
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
        self.principal_to_user_id_map.get(&user_id_or_principal).copied().or_else(|| {
            let user_id: UserId = user_id_or_principal.into();
            self.member_ids.contains(&user_id).then_some(user_id)
        })
    }

    pub fn get(&self, user_id_or_principal: Principal) -> Option<&CommunityMemberInternal> {
        let user_id = user_id_or_principal.into();

        let user_id = self.principal_to_user_id_map.get(&user_id_or_principal).unwrap_or(&user_id);

        self.members.get(user_id)
    }

    pub fn get_by_user_id(&self, user_id: &UserId) -> Option<&CommunityMemberInternal> {
        self.members.get(user_id)
    }

    // Note this lookup is O(n)
    pub fn get_principal(&self, user_id: &UserId) -> Option<Principal> {
        self.principal_to_user_id_map
            .iter()
            .find(|(_, u)| *u == user_id)
            .map(|(p, _)| *p)
    }

    pub fn get_mut(&mut self, user_id_or_principal: Principal) -> Option<&mut CommunityMemberInternal> {
        let user_id = user_id_or_principal.into();

        let user_id = self.principal_to_user_id_map.get(&user_id_or_principal).unwrap_or(&user_id);

        self.members.get_mut(user_id)
    }

    pub fn get_by_user_id_mut(&mut self, user_id: &UserId) -> Option<&mut CommunityMemberInternal> {
        self.members.get_mut(user_id)
    }

    pub fn contains(&self, user_id: &UserId) -> bool {
        self.member_ids.contains(user_id)
    }

    pub fn len(&self) -> u32 {
        self.members.len() as u32
    }

    pub fn member_ids(&self) -> &BTreeSet<UserId> {
        &self.member_ids
    }

    pub fn channels_for_member(&self, user_id: UserId) -> impl Iterator<Item = ChannelId> + '_ {
        self.member_channel_links
            .range((user_id, ChannelId::from(0u32))..)
            .take_while(move |(u, _)| *u == user_id)
            .map(|(_, c)| *c)
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
        if let Some(member) = self.members.get_mut(&user_id) {
            if display_name.is_some() {
                self.members_with_display_names.insert(user_id);
            } else {
                self.members_with_display_names.remove(&user_id);
            }
            member.display_name = Timestamped::new(display_name, now);
            self.updates.insert((now, user_id, MemberUpdate::DisplayNameChanged));
        }
    }

    pub fn update_lapsed(&mut self, user_id: UserId, lapsed: bool, now: TimestampMillis) {
        let Some(member) = self.members.get_mut(&user_id) else {
            return;
        };

        let updated = if lapsed {
            // Owners can't lapse
            !member.is_owner() && member.set_lapsed(true, now)
        } else {
            member.set_lapsed(false, now)
        };

        if updated {
            if lapsed {
                self.lapsed.insert(user_id);
            } else {
                self.lapsed.remove(&user_id);
            }

            self.updates.insert((
                now,
                user_id,
                if lapsed { MemberUpdate::Lapsed } else { MemberUpdate::Unlapsed },
            ));
        }
    }

    pub fn unlapse_all(&mut self, now: TimestampMillis) {
        for user_id in std::mem::take(&mut self.lapsed) {
            if let Some(member) = self.members.get_mut(&user_id) {
                if member.set_lapsed(false, now) {
                    self.updates.insert((now, member.user_id, MemberUpdate::Unlapsed));
                }
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

    #[cfg(test)]
    fn check_invariants(&self) {
        let mut member_ids = BTreeSet::new();
        let mut owners = BTreeSet::new();
        let mut admins = BTreeSet::new();
        let mut lapsed = BTreeSet::new();
        let mut suspended = BTreeSet::new();
        let mut members_with_display_names = BTreeSet::new();
        let mut members_with_referrals = BTreeSet::new();

        for member in self.members.values() {
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

        assert_eq!(member_ids, self.member_ids);
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
        self.get_by_user_id(user_id).cloned()
    }

    fn iter_members_who_can_lapse(&self) -> Box<dyn Iterator<Item = UserId> + '_> {
        Box::new(self.members.values().filter(|m| m.can_member_lapse()).map(|m| m.user_id))
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CommunityMemberInternal {
    #[serde(rename = "u", alias = "user_id")]
    pub user_id: UserId,
    #[serde(rename = "d", alias = "date_added")]
    pub date_added: TimestampMillis,
    #[serde(rename = "r", alias = "role", default, skip_serializing_if = "is_default")]
    role: CommunityRole,
    #[serde(rename = "ra", alias = "rules_accepted", skip_serializing_if = "Option::is_none")]
    pub rules_accepted: Option<Timestamped<Version>>,
    #[serde(rename = "ut", alias = "user_type", default, skip_serializing_if = "is_default")]
    pub user_type: UserType,
    #[serde(rename = "dn", alias = "display_name", default, skip_serializing_if = "is_default")]
    display_name: Timestamped<Option<String>>,
    #[serde(rename = "rb", alias = "referred_by", skip_serializing_if = "Option::is_none")]
    pub referred_by: Option<UserId>,
    #[serde(rename = "rf", alias = "referrals", default, skip_serializing_if = "BTreeSet::is_empty")]
    referrals: BTreeSet<UserId>,
    #[serde(rename = "l", alias = "lapsed", default, skip_serializing_if = "is_default")]
    lapsed: Timestamped<bool>,
    #[serde(rename = "s", alias = "suspended", default, skip_serializing_if = "is_default")]
    suspended: Timestamped<bool>,
}

impl CommunityMemberInternal {
    pub fn accept_rules(&mut self, version: Version, now: TimestampMillis) {
        let already_accepted = self
            .rules_accepted
            .as_ref()
            .map_or(false, |accepted| version <= accepted.value);

        if !already_accepted {
            self.rules_accepted = Some(Timestamped::new(version, now));
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

    pub fn lapsed(&self) -> &Timestamped<bool> {
        &self.lapsed
    }

    pub fn suspended(&self) -> &Timestamped<bool> {
        &self.suspended
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
    use test_case::test_case;
    use types::CanisterId;

    #[test_case(true)]
    #[test_case(false)]
    fn channel_link_sets_maintained_correctly(channels_deleted: bool) {
        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);
        let user_id1 = principal1.into();
        let user_id2 = principal1.into();

        let mut members = CommunityMembers::new(principal1, user_id1, UserType::User, vec![1u32.into()], 0);

        members.add(user_id2, principal2, UserType::User, None, 0);

        for i in 1u32..100 {
            members.mark_member_joined_channel(user_id2, i.into());

            if i % 4 == 0 {
                members.mark_member_left_channel(user_id2, (i / 4).into(), channels_deleted, 0);
            }
        }

        let channel_ids: Vec<_> = members.channels_for_member(user_id2).collect();
        assert_eq!(channel_ids, (25u32..100).map(ChannelId::from).collect::<Vec<_>>());

        let removed: Vec<_> = members.channels_removed_for_member(user_id2).map(|(c, _)| c).collect();
        if channels_deleted {
            assert!(removed.is_empty());
        } else {
            assert_eq!(removed, (1u32..25).map(ChannelId::from).collect::<Vec<_>>());
        }

        members.remove(&user_id2, 0);
        assert!(members.channels_for_member(user_id2).next().is_none());
        assert!(members.channels_removed_for_member(user_id2).next().is_none());
    }

    #[test]
    fn serialize_member_with_max_defaults() {
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
