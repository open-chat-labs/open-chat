use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug, Eq, PartialEq)]
pub enum Role {
    SuperAdmin(FallbackRole),
    Owner,
    Admin,
    Participant,
}

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug, Eq, PartialEq)]
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
    pub change_permissions: PermissionRole,
    pub change_roles: PermissionRole,
    pub add_members: PermissionRole,
    pub remove_members: PermissionRole,
    pub block_users: PermissionRole,
    pub delete_messages: PermissionRole,
    pub update_group: PermissionRole,
    pub pin_messages: PermissionRole,
    pub invite_users: PermissionRole,
    pub create_polls: PermissionRole,
    pub send_messages: PermissionRole,
    pub react_to_messages: PermissionRole,
    pub reply_in_thread: PermissionRole,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct OptionalGroupPermissions {
    pub change_permissions: Option<PermissionRole>,
    pub change_roles: Option<PermissionRole>,
    pub add_members: Option<PermissionRole>,
    pub remove_members: Option<PermissionRole>,
    pub block_users: Option<PermissionRole>,
    pub delete_messages: Option<PermissionRole>,
    pub update_group: Option<PermissionRole>,
    pub pin_messages: Option<PermissionRole>,
    pub invite_users: Option<PermissionRole>,
    pub create_polls: Option<PermissionRole>,
    pub send_messages: Option<PermissionRole>,
    pub react_to_messages: Option<PermissionRole>,
    pub reply_in_thread: Option<PermissionRole>,
}

impl GroupPermissions {
    pub fn permissive() -> GroupPermissions {
        GroupPermissions {
            change_permissions: PermissionRole::Members,
            change_roles: PermissionRole::Members,
            add_members: PermissionRole::Members,
            remove_members: PermissionRole::Members,
            block_users: PermissionRole::Members,
            delete_messages: PermissionRole::Members,
            update_group: PermissionRole::Members,
            pin_messages: PermissionRole::Members,
            invite_users: PermissionRole::Members,
            create_polls: PermissionRole::Members,
            send_messages: PermissionRole::Members,
            react_to_messages: PermissionRole::Members,
            reply_in_thread: PermissionRole::Members,
        }
    }
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
            reply_in_thread: PermissionRole::Members,
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

    pub fn can_reply_in_thread(&self, permissions: &GroupPermissions) -> bool {
        self.is_permitted(permissions.reply_in_thread)
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
