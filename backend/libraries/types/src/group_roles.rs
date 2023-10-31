use crate::OptionUpdate;
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
    pub change_roles: GroupPermissionRole,
    pub update_group: GroupPermissionRole,
    pub add_members: GroupPermissionRole,
    pub invite_users: GroupPermissionRole,
    pub remove_members: GroupPermissionRole,
    pub delete_messages: GroupPermissionRole,
    pub pin_messages: GroupPermissionRole,
    pub react_to_messages: GroupPermissionRole,
    pub mention_all_members: GroupPermissionRole,
    pub message_permissions: MessagePermissions,
    pub thread_permissions: Option<MessagePermissions>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MessagePermissions {
    pub default: GroupPermissionRole,
    pub text: Option<GroupPermissionRole>,
    pub image: Option<GroupPermissionRole>,
    pub video: Option<GroupPermissionRole>,
    pub audio: Option<GroupPermissionRole>,
    pub file: Option<GroupPermissionRole>,
    pub poll: Option<GroupPermissionRole>,
    pub crypto: Option<GroupPermissionRole>,
    pub giphy: Option<GroupPermissionRole>,
    pub prize: Option<GroupPermissionRole>,
    pub custom: Vec<CustomPermission>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CustomPermission {
    pub subtype: String,
    pub role: GroupPermissionRole,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct OptionalGroupPermissions {
    pub change_roles: Option<GroupPermissionRole>,
    pub update_group: Option<GroupPermissionRole>,
    pub invite_users: Option<GroupPermissionRole>,
    pub remove_members: Option<GroupPermissionRole>,
    pub delete_messages: Option<GroupPermissionRole>,
    pub pin_messages: Option<GroupPermissionRole>,
    pub react_to_messages: Option<GroupPermissionRole>,
    pub mention_all_members: Option<GroupPermissionRole>,
    pub message_permissions: Option<OptionalMessagePermissions>,
    pub thread_permissions: OptionUpdate<OptionalMessagePermissions>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct OptionalMessagePermissions {
    pub default: Option<GroupPermissionRole>,
    pub text: OptionUpdate<GroupPermissionRole>,
    pub image: OptionUpdate<GroupPermissionRole>,
    pub video: OptionUpdate<GroupPermissionRole>,
    pub audio: OptionUpdate<GroupPermissionRole>,
    pub file: OptionUpdate<GroupPermissionRole>,
    pub poll: OptionUpdate<GroupPermissionRole>,
    pub crypto: OptionUpdate<GroupPermissionRole>,
    pub giphy: OptionUpdate<GroupPermissionRole>,
    pub prize: OptionUpdate<GroupPermissionRole>,
    pub custom_updated: Vec<CustomPermission>,
    pub custom_deleted: Vec<String>,
}

impl Default for GroupPermissions {
    fn default() -> Self {
        GroupPermissions {
            change_roles: GroupPermissionRole::Admins,
            add_members: GroupPermissionRole::Owner,
            mention_all_members: GroupPermissionRole::Admins,
            remove_members: GroupPermissionRole::Moderators,
            delete_messages: GroupPermissionRole::Moderators,
            update_group: GroupPermissionRole::Admins,
            pin_messages: GroupPermissionRole::Admins,
            invite_users: GroupPermissionRole::Admins,
            react_to_messages: GroupPermissionRole::Members,
            message_permissions: MessagePermissions::default(),
            thread_permissions: None,
        }
    }
}

impl Default for MessagePermissions {
    fn default() -> Self {
        MessagePermissions {
            default: GroupPermissionRole::Members,
            text: None,
            image: None,
            video: None,
            audio: None,
            file: None,
            poll: None,
            crypto: None,
            giphy: None,
            prize: None,
            custom: Vec::new(),
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug, Eq, PartialEq)]
pub enum GroupPermissionRole {
    None,
    Owner,
    Admins,
    Moderators,
    Members,
}

impl GroupPermissionRole {
    pub fn equals(&self, other: &GroupPermissionRole) -> bool {
        std::mem::discriminant(self) == std::mem::discriminant(other)
    }

    pub fn gte(&self, other: &GroupPermissionRole) -> bool {
        self.index() <= other.index()
    }

    fn index(&self) -> usize {
        *self as usize
    }
}
