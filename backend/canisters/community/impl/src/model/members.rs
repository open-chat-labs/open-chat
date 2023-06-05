use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Vacant;
use std::collections::{HashMap, HashSet};
use types::{ChannelId, CommunityMember, CommunityPermissions, CommunityRole, TimestampMillis, Timestamped, UserId};

const MAX_MEMBERS_PER_COMMUNITY: u32 = 100_000;

#[derive(Serialize, Deserialize)]
pub struct CommunityMembers {
    members: HashMap<UserId, CommunityMemberInternal>,
    principal_to_user_id_map: HashMap<Principal, UserId>,
    blocked: HashSet<UserId>,
    admin_count: u32,
    owner_count: u32,
}

impl CommunityMembers {
    pub fn new(creator_principal: Principal, creator_user_id: UserId, now: TimestampMillis) -> CommunityMembers {
        let member = CommunityMemberInternal {
            user_id: creator_user_id,
            date_added: now,
            role: CommunityRole::Owner,
            notifications_muted: Timestamped::new(false, now),
            suspended: Timestamped::default(),
            channels: HashSet::new(),
            channels_removed: Vec::new(),
        };

        CommunityMembers {
            members: vec![(creator_user_id, member)].into_iter().collect(),
            principal_to_user_id_map: vec![(creator_principal, creator_user_id)].into_iter().collect(),
            blocked: HashSet::new(),
            admin_count: 0,
            owner_count: 1,
        }
    }

    pub fn add(&mut self, user_id: UserId, principal: Principal, now: TimestampMillis, notifications_muted: bool) -> AddResult {
        if self.blocked.contains(&user_id) {
            AddResult::Blocked
        } else {
            match self.members.entry(user_id) {
                Vacant(e) => {
                    let member = CommunityMemberInternal {
                        user_id,
                        date_added: now,
                        role: CommunityRole::Member,
                        notifications_muted: Timestamped::new(notifications_muted, now),
                        suspended: Timestamped::default(),
                        channels: HashSet::new(),
                        channels_removed: Vec::new(),
                    };
                    e.insert(member.clone());
                    self.principal_to_user_id_map.insert(principal, user_id);
                    AddResult::Success(member)
                }
                _ => AddResult::AlreadyInCommunity,
            }
        }
    }

    pub fn remove(&mut self, user_id: &UserId) -> Option<CommunityMemberInternal> {
        self.get_principal(user_id)
            .and_then(|principal| self.remove_by_principal(&principal))
    }

    pub fn remove_by_principal(&mut self, principal: &Principal) -> Option<CommunityMemberInternal> {
        if let Some(user_id) = self.principal_to_user_id_map.remove(principal) {
            if let Some(member) = self.members.remove(&user_id) {
                match member.role {
                    CommunityRole::Owner => self.owner_count -= 1,
                    CommunityRole::Admin => self.admin_count -= 1,
                    _ => (),
                }

                return Some(member);
            }
        }

        None
    }

    pub fn change_role(
        &mut self,
        user_id: UserId,
        target_user_id: UserId,
        new_role: CommunityRole,
        permissions: &CommunityPermissions,
        is_caller_platform_moderator: bool,
        is_user_platform_moderator: bool,
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

        let mut owner_count = self.owner_count;
        let mut admin_count = self.admin_count;

        let member = match self.get_by_user_id_mut(&target_user_id) {
            Some(p) => p,
            None => return ChangeRoleResult::TargetUserNotInCommunity,
        };

        // Platform moderators cannot be demoted from owner except by themselves
        if is_user_platform_moderator && member.role.is_owner() && target_user_id != user_id {
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
            CommunityRole::Owner => owner_count -= 1,
            CommunityRole::Admin => admin_count -= 1,
            _ => (),
        }

        member.role = new_role;

        match member.role {
            CommunityRole::Owner => owner_count += 1,
            CommunityRole::Admin => admin_count += 1,
            _ => (),
        }

        self.owner_count = owner_count;
        self.admin_count = admin_count;

        ChangeRoleResult::Success(ChangeRoleSuccessResult {
            caller_id: user_id,
            prev_role,
        })
    }

    pub fn mark_member_joined_channel(&mut self, user_id: &UserId, channel_id: ChannelId) {
        if let Some(member) = self.members.get_mut(user_id) {
            member.channels.insert(channel_id);
        }
    }

    pub fn mark_member_left_channel(&mut self, user_id: &UserId, channel_id: ChannelId, now: TimestampMillis) {
        if let Some(member) = self.members.get_mut(user_id) {
            if member.channels.remove(&channel_id) {
                member.channels_removed.push(Timestamped::new(channel_id, now));
            }
        }
    }

    pub fn block(&mut self, user_id: UserId) {
        self.blocked.insert(user_id);
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

    pub fn iter(&self) -> impl Iterator<Item = &CommunityMemberInternal> {
        self.members.values()
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

    pub fn len(&self) -> u32 {
        self.members.len() as u32
    }

    pub fn owner_count(&self) -> u32 {
        self.owner_count
    }

    pub fn admin_count(&self) -> u32 {
        self.admin_count
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CommunityMemberInternal {
    pub user_id: UserId,
    pub date_added: TimestampMillis,
    pub role: CommunityRole,
    pub notifications_muted: Timestamped<bool>,
    pub suspended: Timestamped<bool>,
    pub channels: HashSet<ChannelId>,
    pub channels_removed: Vec<Timestamped<ChannelId>>,
}

impl CommunityMemberInternal {
    pub fn channels_removed_since(&self, since: TimestampMillis) -> Vec<ChannelId> {
        self.channels_removed
            .iter()
            .rev()
            .take_while(|t| t.timestamp > since)
            .map(|t| t.value)
            .collect()
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
    fn from(p: CommunityMemberInternal) -> Self {
        CommunityMember {
            user_id: p.user_id,
            date_added: p.date_added,
            role: p.role,
        }
    }
}

impl From<&CommunityMemberInternal> for CommunityMember {
    fn from(p: &CommunityMemberInternal) -> Self {
        CommunityMember {
            user_id: p.user_id,
            date_added: p.date_added,
            role: p.role,
        }
    }
}
