use crate::OptionUpdate;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug, Default, Eq, PartialEq)]
pub enum GroupRole {
    Owner,
    Admin,
    Moderator,
    #[default]
    Participant,
}

#[ts_export]
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
    #[serde(default = "admin")]
    pub start_video_call: GroupPermissionRole,
    pub message_permissions: MessagePermissions,
    pub thread_permissions: Option<MessagePermissions>,
}

fn admin() -> GroupPermissionRole {
    GroupPermissionRole::Admins
}

#[ts_export]
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
    pub p2p_swap: Option<GroupPermissionRole>,
    #[serde(default)]
    pub video_call: Option<GroupPermissionRole>,
    pub custom: Vec<CustomPermission>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CustomPermission {
    pub subtype: String,
    pub role: GroupPermissionRole,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct OptionalGroupPermissions {
    pub change_roles: Option<GroupPermissionRole>,
    pub update_group: Option<GroupPermissionRole>,
    pub invite_users: Option<GroupPermissionRole>,
    pub add_members: Option<GroupPermissionRole>,
    pub remove_members: Option<GroupPermissionRole>,
    pub delete_messages: Option<GroupPermissionRole>,
    pub pin_messages: Option<GroupPermissionRole>,
    pub react_to_messages: Option<GroupPermissionRole>,
    pub mention_all_members: Option<GroupPermissionRole>,
    pub start_video_call: Option<GroupPermissionRole>,
    pub message_permissions: Option<OptionalMessagePermissions>,
    #[ts(as = "crate::OptionUpdateOptionalMessagePermissions")]
    pub thread_permissions: OptionUpdate<OptionalMessagePermissions>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct OptionalMessagePermissions {
    pub default: Option<GroupPermissionRole>,
    #[ts(as = "crate::OptionUpdateGroupPermissionRole")]
    pub text: OptionUpdate<GroupPermissionRole>,
    #[ts(as = "crate::OptionUpdateGroupPermissionRole")]
    pub image: OptionUpdate<GroupPermissionRole>,
    #[ts(as = "crate::OptionUpdateGroupPermissionRole")]
    pub video: OptionUpdate<GroupPermissionRole>,
    #[ts(as = "crate::OptionUpdateGroupPermissionRole")]
    pub audio: OptionUpdate<GroupPermissionRole>,
    #[ts(as = "crate::OptionUpdateGroupPermissionRole")]
    pub file: OptionUpdate<GroupPermissionRole>,
    #[ts(as = "crate::OptionUpdateGroupPermissionRole")]
    pub poll: OptionUpdate<GroupPermissionRole>,
    #[ts(as = "crate::OptionUpdateGroupPermissionRole")]
    pub crypto: OptionUpdate<GroupPermissionRole>,
    #[ts(as = "crate::OptionUpdateGroupPermissionRole")]
    pub giphy: OptionUpdate<GroupPermissionRole>,
    #[ts(as = "crate::OptionUpdateGroupPermissionRole")]
    pub prize: OptionUpdate<GroupPermissionRole>,
    #[ts(as = "crate::OptionUpdateGroupPermissionRole")]
    pub p2p_swap: OptionUpdate<GroupPermissionRole>,
    #[ts(as = "crate::OptionUpdateGroupPermissionRole")]
    pub video_call: OptionUpdate<GroupPermissionRole>,
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
            start_video_call: GroupPermissionRole::Admins,
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
            p2p_swap: None,
            video_call: None,
            custom: Vec::new(),
        }
    }
}

#[ts_export]
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

#[ts_export]
#[repr(u8)]
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ChatPermission {
    ChangeRoles = 0,
    UpdateGroup = 1,
    AddMembers = 2,
    InviteUsers = 3,
    RemoveMembers = 4,
    DeleteMessages = 5,
    PinMessages = 6,
    ReactToMessages = 7,
    MentionAllMembers = 8,
    StartVideoCall = 9,
    ReadMessages = 10,
    ReadMembership = 11,
    ReadChatDetails = 12,
}

impl From<ChatPermission> for u8 {
    fn from(value: ChatPermission) -> Self {
        value as u8
    }
}

impl TryFrom<u8> for ChatPermission {
    type Error = ();

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(ChatPermission::ChangeRoles),
            1 => Ok(ChatPermission::UpdateGroup),
            2 => Ok(ChatPermission::AddMembers),
            3 => Ok(ChatPermission::InviteUsers),
            4 => Ok(ChatPermission::RemoveMembers),
            5 => Ok(ChatPermission::DeleteMessages),
            6 => Ok(ChatPermission::PinMessages),
            7 => Ok(ChatPermission::ReactToMessages),
            8 => Ok(ChatPermission::MentionAllMembers),
            9 => Ok(ChatPermission::StartVideoCall),
            10 => Ok(ChatPermission::ReadMessages),
            11 => Ok(ChatPermission::ReadMembership),
            12 => Ok(ChatPermission::ReadChatDetails),
            _ => Err(()),
        }
    }
}

#[ts_export]
#[repr(u8)]
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum MessagePermission {
    Text = 0,
    Image = 1,
    Video = 2,
    Audio = 3,
    File = 4,
    Poll = 5,
    Crypto = 6,
    Giphy = 7,
    Prize = 8,
    P2pSwap = 9,
    VideoCall = 10,
}

impl From<MessagePermission> for u8 {
    fn from(value: MessagePermission) -> Self {
        value as u8
    }
}

impl TryFrom<u8> for MessagePermission {
    type Error = ();

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(MessagePermission::Text),
            1 => Ok(MessagePermission::Image),
            2 => Ok(MessagePermission::Video),
            3 => Ok(MessagePermission::Audio),
            4 => Ok(MessagePermission::File),
            5 => Ok(MessagePermission::Poll),
            6 => Ok(MessagePermission::Crypto),
            7 => Ok(MessagePermission::Giphy),
            8 => Ok(MessagePermission::Prize),
            9 => Ok(MessagePermission::P2pSwap),
            10 => Ok(MessagePermission::VideoCall),
            _ => Err(()),
        }
    }
}
