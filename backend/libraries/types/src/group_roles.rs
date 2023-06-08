use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug, Default, Eq, PartialEq)]
pub enum GroupRole {
    Owner,
    Admin,
    Moderator,
    #[default]
    Participant,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupPermissions {
    pub change_permissions: GroupPermissionRole,
    pub change_roles: GroupPermissionRole,
    pub add_members: GroupPermissionRole,
    pub remove_members: GroupPermissionRole,
    pub block_users: GroupPermissionRole,
    pub delete_messages: GroupPermissionRole,
    pub update_group: GroupPermissionRole,
    pub pin_messages: GroupPermissionRole,
    pub invite_users: GroupPermissionRole,
    pub create_polls: GroupPermissionRole,
    pub send_messages: GroupPermissionRole,
    pub react_to_messages: GroupPermissionRole,
    pub reply_in_thread: GroupPermissionRole,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct OptionalGroupPermissions {
    pub change_permissions: Option<GroupPermissionRole>,
    pub change_roles: Option<GroupPermissionRole>,
    pub remove_members: Option<GroupPermissionRole>,
    pub block_users: Option<GroupPermissionRole>,
    pub delete_messages: Option<GroupPermissionRole>,
    pub update_group: Option<GroupPermissionRole>,
    pub pin_messages: Option<GroupPermissionRole>,
    pub invite_users: Option<GroupPermissionRole>,
    pub create_polls: Option<GroupPermissionRole>,
    pub send_messages: Option<GroupPermissionRole>,
    pub react_to_messages: Option<GroupPermissionRole>,
    pub reply_in_thread: Option<GroupPermissionRole>,
}

impl Default for GroupPermissions {
    fn default() -> Self {
        GroupPermissions {
            change_permissions: GroupPermissionRole::Admins,
            change_roles: GroupPermissionRole::Admins,
            add_members: GroupPermissionRole::Admins,
            remove_members: GroupPermissionRole::Moderators,
            block_users: GroupPermissionRole::Moderators,
            delete_messages: GroupPermissionRole::Moderators,
            update_group: GroupPermissionRole::Admins,
            pin_messages: GroupPermissionRole::Admins,
            invite_users: GroupPermissionRole::Admins,
            create_polls: GroupPermissionRole::Members,
            send_messages: GroupPermissionRole::Members,
            react_to_messages: GroupPermissionRole::Members,
            reply_in_thread: GroupPermissionRole::Members,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug)]
pub enum GroupPermissionRole {
    Owner,
    Admins,
    Moderators,
    Members,
}

impl GroupRole {
    pub fn is_owner(&self) -> bool {
        matches!(self, GroupRole::Owner)
    }

    pub fn is_admin(&self) -> bool {
        matches!(self, GroupRole::Admin)
    }

    pub fn is_moderator(&self) -> bool {
        matches!(self, GroupRole::Moderator)
    }

    pub fn can_change_permissions(&self, permissions: &GroupPermissions) -> bool {
        self.is_permitted(permissions.change_permissions)
    }

    pub fn can_change_roles(&self, new_role: GroupRole, permissions: &GroupPermissions) -> bool {
        self.is_same_or_senior(new_role) && self.is_permitted(permissions.change_roles)
    }

    pub fn can_add_members(&self, permissions: &GroupPermissions) -> bool {
        self.is_permitted(permissions.add_members)
    }

    pub fn can_remove_members(&self, permissions: &GroupPermissions) -> bool {
        self.is_permitted(permissions.remove_members)
    }

    pub fn can_remove_members_with_role(&self, member_role: GroupRole, permissions: &GroupPermissions) -> bool {
        self.is_same_or_senior(member_role) && self.is_permitted(permissions.remove_members)
    }

    pub fn can_block_users(&self, permissions: &GroupPermissions) -> bool {
        self.is_permitted(permissions.block_users)
    }

    pub fn can_block_users_with_role(&self, user_role: GroupRole, permissions: &GroupPermissions) -> bool {
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

    pub fn is_same_or_senior(&self, role: GroupRole) -> bool {
        match role {
            GroupRole::Owner => self.has_owner_rights(),
            GroupRole::Admin => self.has_admin_rights(),
            GroupRole::Moderator => self.has_moderator_rights(),
            GroupRole::Participant => true,
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
