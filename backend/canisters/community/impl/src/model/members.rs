use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Vacant;
use std::collections::{HashMap, HashSet};
use types::{CommunityPermissions, CommunityRole, TimestampMillis, Timestamped, UserId};

#[derive(Serialize, Deserialize)]
pub struct CommunityMembers {
    by_principal: HashMap<Principal, CommunityMemberInternal>,
    user_id_to_principal_map: HashMap<UserId, Principal>,
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
        };

        CommunityMembers {
            by_principal: vec![(creator_principal, member)].into_iter().collect(),
            user_id_to_principal_map: vec![(creator_user_id, creator_principal)].into_iter().collect(),
            blocked: HashSet::new(),
            admin_count: 0,
            owner_count: 1,
        }
    }

    pub fn add(&mut self, user_id: UserId, principal: Principal, now: TimestampMillis, notifications_muted: bool) -> AddResult {
        if self.blocked.contains(&user_id) {
            AddResult::Blocked
        } else {
            match self.by_principal.entry(principal) {
                Vacant(e) => {
                    let member = CommunityMemberInternal {
                        user_id,
                        date_added: now,
                        role: CommunityRole::Member,
                        notifications_muted: Timestamped::new(notifications_muted, now),
                        suspended: Timestamped::default(),
                    };
                    e.insert(member.clone());
                    self.user_id_to_principal_map.insert(user_id, principal);
                    AddResult::Success(member)
                }
                _ => AddResult::AlreadyInGroup,
            }
        }
    }

    pub fn change_role(
        &mut self,
        caller_id: UserId,
        user_id: UserId,
        new_role: CommunityRole,
        permissions: &CommunityPermissions,
        is_caller_platform_moderator: bool,
        is_user_platform_moderator: bool,
    ) -> ChangeRoleResult {
        // Is the caller authorized to change the user to this role
        match self.get(caller_id.into()) {
            Some(p) => {
                if p.suspended.value {
                    return ChangeRoleResult::UserSuspended;
                }
                // Platform moderators can always promote themselves to owner
                if !(p.role.can_change_roles(new_role, permissions) || (is_caller_platform_moderator && new_role.is_owner())) {
                    return ChangeRoleResult::NotAuthorized;
                }
            }
            None => return ChangeRoleResult::CallerNotInCommunity,
        }

        let mut owner_count = self.owner_count;
        let mut admin_count = self.admin_count;

        let member = match self.get_mut(user_id.into()) {
            Some(p) => p,
            None => return ChangeRoleResult::UserNotInCommunity,
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

        ChangeRoleResult::Success(ChangeRoleSuccessResult { caller_id, prev_role })
    }

    pub fn get(&self, user_id_or_principal: Principal) -> Option<&CommunityMemberInternal> {
        let principal = self
            .user_id_to_principal_map
            .get(&user_id_or_principal.into())
            .unwrap_or(&user_id_or_principal);

        self.by_principal.get(principal)
    }

    pub fn get_mut(&mut self, user_id_or_principal: Principal) -> Option<&mut CommunityMemberInternal> {
        let principal = self
            .user_id_to_principal_map
            .get(&user_id_or_principal.into())
            .unwrap_or(&user_id_or_principal);

        self.by_principal.get_mut(principal)
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
}

#[allow(clippy::large_enum_variant)]
pub enum AddResult {
    Success(CommunityMemberInternal),
    AlreadyInGroup,
    Blocked,
}

pub enum ChangeRoleResult {
    Success(ChangeRoleSuccessResult),
    CallerNotInCommunity,
    NotAuthorized,
    UserNotInCommunity,
    Unchanged,
    Invalid,
    UserSuspended,
}

pub struct ChangeRoleSuccessResult {
    pub caller_id: UserId,
    pub prev_role: CommunityRole,
}
