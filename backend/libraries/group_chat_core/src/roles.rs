use serde::{Deserialize, Serialize};
use types::{GroupPermissionRole, GroupPermissions, GroupRole};

#[derive(Serialize, Deserialize, Copy, Clone, Debug, Default, Eq, PartialEq)]
pub enum GroupRoleInternal {
    #[serde(rename = "o", alias = "Owner")]
    Owner,
    #[serde(rename = "a", alias = "Admin")]
    Admin,
    #[serde(rename = "mo", alias = "Moderator")]
    Moderator,
    #[default]
    #[serde(rename = "m", alias = "Participant")]
    Member,
}

impl From<GroupRole> for GroupRoleInternal {
    fn from(value: GroupRole) -> Self {
        match value {
            GroupRole::Owner => GroupRoleInternal::Owner,
            GroupRole::Admin => GroupRoleInternal::Admin,
            GroupRole::Moderator => GroupRoleInternal::Moderator,
            GroupRole::Participant => GroupRoleInternal::Member,
        }
    }
}

impl From<GroupRoleInternal> for GroupRole {
    fn from(value: GroupRoleInternal) -> Self {
        match value {
            GroupRoleInternal::Owner => GroupRole::Owner,
            GroupRoleInternal::Admin => GroupRole::Admin,
            GroupRoleInternal::Moderator => GroupRole::Moderator,
            GroupRoleInternal::Member => GroupRole::Participant,
        }
    }
}

impl GroupRoleInternal {
    pub fn is_owner(&self) -> bool {
        matches!(self, GroupRoleInternal::Owner)
    }

    pub fn is_admin(&self) -> bool {
        matches!(self, GroupRoleInternal::Admin)
    }

    pub fn is_moderator(&self) -> bool {
        matches!(self, GroupRoleInternal::Moderator)
    }

    pub fn can_change_permissions(&self, permissions: &GroupPermissions) -> bool {
        self.is_permitted(permissions.change_permissions)
    }

    pub fn can_change_roles(&self, new_role: GroupRoleInternal, permissions: &GroupPermissions) -> bool {
        self.is_same_or_senior(new_role) && self.is_permitted(permissions.change_roles)
    }

    pub fn can_add_members(&self, permissions: &GroupPermissions) -> bool {
        self.is_permitted(permissions.add_members)
    }

    pub fn can_remove_members(&self, permissions: &GroupPermissions) -> bool {
        self.is_permitted(permissions.remove_members)
    }

    pub fn can_remove_members_with_role(&self, member_role: GroupRoleInternal, permissions: &GroupPermissions) -> bool {
        self.is_same_or_senior(member_role) && self.is_permitted(permissions.remove_members)
    }

    pub fn can_block_users(&self, permissions: &GroupPermissions) -> bool {
        self.is_permitted(permissions.block_users)
    }

    pub fn can_block_users_with_role(&self, user_role: GroupRoleInternal, permissions: &GroupPermissions) -> bool {
        self.is_same_or_senior(user_role) && self.is_permitted(permissions.block_users)
    }

    pub fn can_unblock_users(&self, permissions: &GroupPermissions) -> bool {
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

    pub fn is_permitted(&self, permission_role: GroupPermissionRole) -> bool {
        match permission_role {
            GroupPermissionRole::Owner => self.has_owner_rights(),
            GroupPermissionRole::Admins => self.has_admin_rights(),
            GroupPermissionRole::Moderators => self.has_moderator_rights(),
            GroupPermissionRole::Members => true,
        }
    }

    pub fn is_same_or_senior(&self, role: GroupRoleInternal) -> bool {
        match role {
            GroupRoleInternal::Owner => self.has_owner_rights(),
            GroupRoleInternal::Admin => self.has_admin_rights(),
            GroupRoleInternal::Moderator => self.has_moderator_rights(),
            GroupRoleInternal::Member => true,
        }
    }

    fn has_moderator_rights(&self) -> bool {
        self.is_moderator() || self.has_admin_rights()
    }

    fn has_admin_rights(&self) -> bool {
        self.is_admin() || self.has_owner_rights()
    }

    fn has_owner_rights(&self) -> bool {
        self.is_owner()
    }
}
