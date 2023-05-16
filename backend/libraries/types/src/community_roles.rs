use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug, Eq, PartialEq)]
pub enum CommunityRole {
    Owner,
    Admin,
    Participant,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityPermissions {
    pub change_permissions: CommunityPermissionRole,
    pub change_roles: CommunityPermissionRole,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct OptionalCommunityPermissions {
    pub change_permissions: Option<CommunityPermissionRole>,
    pub change_roles: Option<CommunityPermissionRole>,
}

impl Default for CommunityPermissions {
    fn default() -> Self {
        CommunityPermissions {
            change_permissions: CommunityPermissionRole::Admins,
            change_roles: CommunityPermissionRole::Admins,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug)]
pub enum CommunityPermissionRole {
    Owner,
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
            CommunityPermissionRole::Owner => self.has_owner_rights(),
            CommunityPermissionRole::Admins => self.has_admin_rights(),
            CommunityPermissionRole::Members => true,
        }
    }

    pub fn is_same_or_senior(&self, role: CommunityRole) -> bool {
        match role {
            CommunityRole::Owner => self.has_owner_rights(),
            CommunityRole::Admin => self.has_admin_rights(),
            CommunityRole::Participant => true,
        }
    }

    fn has_admin_rights(&self) -> bool {
        self.is_admin() || self.has_owner_rights()
    }

    fn has_owner_rights(&self) -> bool {
        self.is_owner()
    }
}
