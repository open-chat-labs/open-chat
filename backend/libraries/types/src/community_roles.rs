use std::collections::HashSet;

use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug, Default, Eq, PartialEq)]
pub enum CommunityRole {
    Owner,
    Admin,
    #[default]
    Member,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum CommunityPermission {
    ChangeRoles,
    UpdateDetails,
    InviteUsers,
    RemoveMembers,
    CreatePublicChannel,
    CreatePrivateChannel,
    ManageUserGroups,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityPermissions {
    pub change_roles: CommunityPermissionRole,
    pub update_details: CommunityPermissionRole,
    pub invite_users: CommunityPermissionRole,
    pub remove_members: CommunityPermissionRole,
    pub create_public_channel: CommunityPermissionRole,
    pub create_private_channel: CommunityPermissionRole,
    pub manage_user_groups: CommunityPermissionRole,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct OptionalCommunityPermissions {
    pub change_roles: Option<CommunityPermissionRole>,
    pub update_details: Option<CommunityPermissionRole>,
    pub invite_users: Option<CommunityPermissionRole>,
    pub remove_members: Option<CommunityPermissionRole>,
    pub create_public_channel: Option<CommunityPermissionRole>,
    pub create_private_channel: Option<CommunityPermissionRole>,
    pub manage_user_groups: Option<CommunityPermissionRole>,
}

impl Default for CommunityPermissions {
    fn default() -> Self {
        CommunityPermissions {
            change_roles: CommunityPermissionRole::Admins,
            update_details: CommunityPermissionRole::Admins,
            invite_users: CommunityPermissionRole::Admins,
            remove_members: CommunityPermissionRole::Admins,
            create_public_channel: CommunityPermissionRole::Admins,
            create_private_channel: CommunityPermissionRole::Admins,
            manage_user_groups: CommunityPermissionRole::Admins,
        }
    }
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug)]
pub enum CommunityPermissionRole {
    Owners,
    Admins,
    Members,
}

impl CommunityRole {
    pub fn is_owner(&self) -> bool {
        matches!(self, CommunityRole::Owner)
    }

    pub fn is_admin(&self) -> bool {
        matches!(self, CommunityRole::Admin)
    }

    pub fn can_change_permissions(&self) -> bool {
        self.is_owner()
    }

    pub fn can_change_roles(&self, new_role: CommunityRole, permissions: &CommunityPermissions) -> bool {
        self.is_same_or_senior(new_role) && self.is_permitted(permissions.change_roles)
    }

    pub fn can_invite_users(&self, permissions: &CommunityPermissions) -> bool {
        self.is_permitted(permissions.invite_users)
    }

    pub fn can_remove_members(&self, permissions: &CommunityPermissions) -> bool {
        self.is_permitted(permissions.remove_members)
    }

    pub fn can_remove_members_with_role(&self, member_role: CommunityRole, permissions: &CommunityPermissions) -> bool {
        self.is_same_or_senior(member_role) && self.is_permitted(permissions.remove_members)
    }

    pub fn can_block_users(&self, permissions: &CommunityPermissions) -> bool {
        self.is_permitted(permissions.remove_members)
    }

    pub fn can_unblock_users(&self, permissions: &CommunityPermissions) -> bool {
        self.is_permitted(permissions.remove_members)
    }

    pub fn can_update_details(&self, permissions: &CommunityPermissions) -> bool {
        self.is_permitted(permissions.update_details)
    }

    pub fn can_create_public_channel(&self, permissions: &CommunityPermissions) -> bool {
        self.is_permitted(permissions.create_public_channel)
    }

    pub fn can_create_private_channel(&self, permissions: &CommunityPermissions) -> bool {
        self.is_permitted(permissions.create_private_channel)
    }

    pub fn can_manage_user_groups(&self, permissions: &CommunityPermissions) -> bool {
        self.is_permitted(permissions.manage_user_groups)
    }

    pub fn can_delete_community(&self) -> bool {
        self.has_owner_rights()
    }

    pub fn is_permitted(&self, permission_role: CommunityPermissionRole) -> bool {
        match permission_role {
            CommunityPermissionRole::Owners => self.has_owner_rights(),
            CommunityPermissionRole::Admins => self.has_admin_rights(),
            CommunityPermissionRole::Members => true,
        }
    }

    pub fn is_same_or_senior(&self, role: CommunityRole) -> bool {
        match role {
            CommunityRole::Owner => self.has_owner_rights(),
            CommunityRole::Admin => self.has_admin_rights(),
            CommunityRole::Member => true,
        }
    }

    pub fn can_change_community_visibility(&self) -> bool {
        self.is_owner()
    }

    fn has_admin_rights(&self) -> bool {
        self.is_admin() || self.has_owner_rights()
    }

    fn has_owner_rights(&self) -> bool {
        self.is_owner()
    }

    pub fn permissions(&self, rps: &CommunityPermissions) -> HashSet<CommunityPermission> {
        let permissions = [
            (rps.change_roles, CommunityPermission::ChangeRoles),
            (rps.create_private_channel, CommunityPermission::CreatePrivateChannel),
            (rps.create_public_channel, CommunityPermission::CreatePublicChannel),
            (rps.invite_users, CommunityPermission::InviteUsers),
            (rps.manage_user_groups, CommunityPermission::ManageUserGroups),
            (rps.remove_members, CommunityPermission::RemoveMembers),
            (rps.update_details, CommunityPermission::UpdateDetails),
        ];

        permissions
            .into_iter()
            .filter_map(|(rp, p)| self.is_permitted(rp).then_some(p))
            .collect()
    }
}
