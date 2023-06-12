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
