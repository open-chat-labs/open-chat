use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug, PartialEq)]
pub enum Role {
    SuperAdmin(FallbackRole),
    Owner,
    Admin,
    Participant,
}

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug, PartialEq)]
pub enum FallbackRole {
    Admin,
    Participant,
}

impl From<FallbackRole> for Role {
    fn from(role: FallbackRole) -> Self {
        match role {
            FallbackRole::Participant => Role::Participant,
            FallbackRole::Admin => Role::Admin,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupPermissions {
    change_permissions: PermissionRole,
    change_roles: PermissionRole,
    add_members: PermissionRole,
    remove_members: PermissionRole,
    block_users: PermissionRole,
    delete_messages: PermissionRole,
    update_group: PermissionRole,
    pin_messages: PermissionRole,
    #[serde(default = "admin_permission")]
    invite_users: PermissionRole,
    create_polls: PermissionRole,
    send_messages: PermissionRole,
    react_to_messages: PermissionRole,
}

fn admin_permission() -> PermissionRole {
    PermissionRole::Admins
}

impl Default for GroupPermissions {
    fn default() -> Self {
        GroupPermissions {
            change_permissions: PermissionRole::Admins,
            change_roles: PermissionRole::Admins,
            add_members: PermissionRole::Admins,
            remove_members: PermissionRole::Admins,
            block_users: PermissionRole::Admins,
            delete_messages: PermissionRole::Admins,
            update_group: PermissionRole::Admins,
            pin_messages: PermissionRole::Admins,
            invite_users: PermissionRole::Admins,
            create_polls: PermissionRole::Members,
            send_messages: PermissionRole::Members,
            react_to_messages: PermissionRole::Members,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug)]
pub enum PermissionRole {
    Owner,
    Admins,
    Members,
}

impl Role {
    pub fn is_owner(&self) -> bool {
        matches!(self, Role::Owner)
    }

    pub fn is_admin(&self) -> bool {
        matches!(self, Role::Admin | Role::SuperAdmin(FallbackRole::Admin))
    }

    pub fn can_change_permissions(&self, permissions: &GroupPermissions) -> bool {
        self.is_permitted(permissions.change_permissions)
    }

    pub fn can_change_roles(&self, new_role: Role, permissions: &GroupPermissions) -> bool {
        match new_role {
            Role::SuperAdmin(_) => false,
            Role::Owner => self.has_owner_rights(),
            _ => self.is_permitted(permissions.change_roles),
        }
    }

    pub fn can_add_members(&self, permissions: &GroupPermissions, is_public_group: bool) -> bool {
        !is_public_group && self.is_permitted(permissions.add_members)
    }

    pub fn can_remove_members(&self, permissions: &GroupPermissions) -> bool {
        self.is_permitted(permissions.remove_members)
    }

    pub fn can_block_users(&self, permissions: &GroupPermissions) -> bool {
        self.is_permitted(permissions.block_users)
    }

    pub fn can_delete_messages(&self, permissions: &GroupPermissions) -> bool {
        self.is_permitted(permissions.delete_messages)
    }

    pub fn can_update_group(&self, permissions: &GroupPermissions) -> bool {
        self.is_permitted(permissions.update_group)
    }

    pub fn can_pin_messages(&self, permissions: &GroupPermissions) -> bool {
        self.is_permitted(permissions.pin_messages)
    }

    pub fn can_create_polls(&self, permissions: &GroupPermissions) -> bool {
        self.is_permitted(permissions.create_polls)
    }

    pub fn can_send_messages(&self, permissions: &GroupPermissions) -> bool {
        self.is_permitted(permissions.send_messages)
    }

    pub fn can_react_to_messages(&self, permissions: &GroupPermissions) -> bool {
        self.is_permitted(permissions.react_to_messages)
    }

    pub fn can_be_removed(&self) -> bool {
        !self.has_owner_rights()
    }

    pub fn can_leave(&self) -> bool {
        !self.is_owner()
    }

    pub fn can_delete_group(&self) -> bool {
        self.has_owner_rights()
    }

    pub fn can_change_group_visibility(&self) -> bool {
        self.has_owner_rights()
    }

    pub fn can_view_full_message_history(&self) -> bool {
        self.has_owner_rights()
    }

    pub fn can_invite_users(&self, permissions: &GroupPermissions) -> bool {
        self.is_permitted(permissions.invite_users)
    }

    pub fn is_permitted(&self, permission_role: PermissionRole) -> bool {
        match permission_role {
            PermissionRole::Owner => self.has_owner_rights(),
            PermissionRole::Admins => self.has_admin_rights(),
            PermissionRole::Members => true,
        }
    }

    fn has_admin_rights(&self) -> bool {
        matches!(self, Role::Admin) || self.has_owner_rights()
    }

    fn has_owner_rights(&self) -> bool {
        matches!(self, Role::Owner | Role::SuperAdmin(_))
    }
}
