use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug, Eq, PartialEq)]
pub enum CommunityRole {
    Owner,
    Admin,
    Member,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityPermissions {
    pub change_permissions: CommunityPermissionRole,
    pub change_roles: CommunityPermissionRole,
    pub invite_users: CommunityPermissionRole,
    pub remove_members: CommunityPermissionRole,
    pub block_users: CommunityPermissionRole,
    pub update_details: CommunityPermissionRole,
    pub create_public_group: CommunityPermissionRole,
    pub create_private_group: CommunityPermissionRole,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct OptionalCommunityPermissions {
    pub change_permissions: Option<CommunityPermissionRole>,
    pub change_roles: Option<CommunityPermissionRole>,
    pub invite_users: Option<CommunityPermissionRole>,
    pub remove_members: Option<CommunityPermissionRole>,
    pub block_users: Option<CommunityPermissionRole>,
    pub update_details: Option<CommunityPermissionRole>,
    pub create_public_group: Option<CommunityPermissionRole>,
    pub create_private_group: Option<CommunityPermissionRole>,
}

impl Default for CommunityPermissions {
    fn default() -> Self {
        CommunityPermissions {
            change_permissions: CommunityPermissionRole::Admins,
            change_roles: CommunityPermissionRole::Admins,
            invite_users: CommunityPermissionRole::Admins,
            remove_members: CommunityPermissionRole::Admins,
            block_users: CommunityPermissionRole::Admins,
            update_details: CommunityPermissionRole::Admins,        
            create_public_group: CommunityPermissionRole::Members,
            create_private_group: CommunityPermissionRole::Members,
        }
    }
}

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

    pub fn can_change_permissions(&self, permissions: &CommunityPermissions) -> bool {
        self.is_permitted(permissions.change_permissions)
    }

    pub fn can_change_roles(&self, new_role: CommunityRole, permissions: &CommunityPermissions) -> bool {
        self.is_same_or_senior(new_role) && self.is_permitted(permissions.change_roles)
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

    fn has_admin_rights(&self) -> bool {
        self.is_admin() || self.has_owner_rights()
    }

    fn has_owner_rights(&self) -> bool {
        self.is_owner()
    }
}
