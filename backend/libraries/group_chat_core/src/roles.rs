use std::collections::HashSet;

use serde::{Deserialize, Serialize};
use types::{
    GroupPermission, GroupPermissionRole, GroupPermissions, GroupRole, MessageContentType, MessagePermission,
    MessagePermissions,
};

#[derive(Serialize, Deserialize, Copy, Clone, Debug, Default, Eq, PartialEq)]
pub enum GroupRoleInternal {
    #[serde(rename = "o")]
    Owner,
    #[serde(rename = "a")]
    Admin,
    #[serde(rename = "mo")]
    Moderator,
    #[default]
    #[serde(rename = "m")]
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

    pub fn can_change_permissions(&self) -> bool {
        self.is_owner()
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
        self.is_permitted(permissions.remove_members)
    }

    pub fn can_block_users_with_role(&self, user_role: GroupRoleInternal, permissions: &GroupPermissions) -> bool {
        self.is_same_or_senior(user_role) && self.is_permitted(permissions.remove_members)
    }

    pub fn can_unblock_users(&self, permissions: &GroupPermissions) -> bool {
        self.is_permitted(permissions.remove_members)
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

    pub fn can_send_message(&self, message_type: MessageContentType, is_thread: bool, permissions: &GroupPermissions) -> bool {
        let ps = if is_thread && permissions.thread_permissions.is_some() {
            permissions.thread_permissions.as_ref().unwrap()
        } else {
            &permissions.message_permissions
        };

        let sender_role = match message_type {
            MessageContentType::Text => ps.text.unwrap_or(ps.default),
            MessageContentType::Image => ps.image.unwrap_or(ps.default),
            MessageContentType::Video => ps.video.unwrap_or(ps.default),
            MessageContentType::Audio => ps.audio.unwrap_or(ps.default),
            MessageContentType::File => ps.file.unwrap_or(ps.default),
            MessageContentType::Poll => ps.poll.unwrap_or(ps.default),
            MessageContentType::Crypto => ps.crypto.unwrap_or(ps.default),
            MessageContentType::Giphy => ps.giphy.unwrap_or(ps.default),
            MessageContentType::Prize => ps.prize.unwrap_or(ps.default),
            MessageContentType::P2PSwap => ps.p2p_swap.unwrap_or(ps.default),
            MessageContentType::VideoCall => permissions.start_video_call,
            MessageContentType::Custom(c) => ps
                .custom
                .iter()
                .find(|cp| cp.subtype == c)
                .map(|cp| cp.role)
                .unwrap_or(ps.default),
            MessageContentType::Deleted
            | MessageContentType::GovernanceProposal
            | MessageContentType::MessageReminderCreated
            | MessageContentType::MessageReminder
            | MessageContentType::PrizeWinner
            | MessageContentType::ReportedMessage => GroupPermissionRole::None,
        };

        self.is_permitted(sender_role)
    }

    pub fn can_react_to_messages(&self, permissions: &GroupPermissions) -> bool {
        self.is_permitted(permissions.react_to_messages)
    }

    pub fn can_delete_group(&self) -> bool {
        self.is_owner()
    }

    pub fn can_change_group_visibility(&self) -> bool {
        self.is_owner()
    }

    pub fn can_view_full_message_history(&self) -> bool {
        self.is_owner()
    }

    pub fn can_invite_users(&self, permissions: &GroupPermissions) -> bool {
        self.is_permitted(permissions.invite_users)
    }

    pub fn can_mention_everyone(&self, permissions: &GroupPermissions) -> bool {
        self.is_permitted(permissions.mention_all_members)
    }

    pub fn is_permitted(&self, permission_role: GroupPermissionRole) -> bool {
        match permission_role {
            GroupPermissionRole::None => false,
            GroupPermissionRole::Owner => self.is_owner(),
            GroupPermissionRole::Admins => self.has_admin_rights(),
            GroupPermissionRole::Moderators => self.has_moderator_rights(),
            GroupPermissionRole::Members => true,
        }
    }

    pub fn is_same_or_senior(&self, role: GroupRoleInternal) -> bool {
        match role {
            GroupRoleInternal::Owner => self.is_owner(),
            GroupRoleInternal::Admin => self.has_admin_rights(),
            GroupRoleInternal::Moderator => self.has_moderator_rights(),
            GroupRoleInternal::Member => true,
        }
    }

    fn has_moderator_rights(&self) -> bool {
        self.is_moderator() || self.has_admin_rights()
    }

    fn has_admin_rights(&self) -> bool {
        self.is_admin() || self.is_owner()
    }

    pub fn permissions(&self, role_permissions: &GroupPermissions) -> HashSet<GroupPermission> {
        let permissions = [
            (role_permissions.add_members, GroupPermission::AddMembers),
            (role_permissions.change_roles, GroupPermission::ChangeRoles),
            (role_permissions.delete_messages, GroupPermission::DeleteMessages),
            (role_permissions.invite_users, GroupPermission::InviteUsers),
            (role_permissions.mention_all_members, GroupPermission::MentionAllMembers),
            (role_permissions.pin_messages, GroupPermission::PinMessages),
            (role_permissions.react_to_messages, GroupPermission::ReactToMessages),
            (role_permissions.remove_members, GroupPermission::RemoveMembers),
            (role_permissions.start_video_call, GroupPermission::StartVideoCall),
            (role_permissions.update_group, GroupPermission::UpdateGroup),
        ];

        permissions
            .into_iter()
            .filter_map(|(rp, p)| self.is_permitted(rp).then_some(p))
            .collect()
    }

    pub fn message_permissions(&self, role_permissions: &MessagePermissions) -> HashSet<MessagePermission> {
        let permissions = vec![
            (role_permissions.audio, MessagePermission::Audio),
            (role_permissions.crypto, MessagePermission::Crypto),
            (role_permissions.file, MessagePermission::File),
            (role_permissions.giphy, MessagePermission::Giphy),
            (role_permissions.image, MessagePermission::Image),
            (role_permissions.p2p_swap, MessagePermission::P2pSwap),
            (role_permissions.poll, MessagePermission::Poll),
            (role_permissions.prize, MessagePermission::Prize),
            (role_permissions.text, MessagePermission::Text),
            (role_permissions.video, MessagePermission::Video),
        ];

        let default_permitted = self.is_permitted(role_permissions.default);

        permissions
            .into_iter()
            .filter_map(|(orp, p)| orp.map_or(default_permitted, |rp| self.is_permitted(rp)).then_some(p))
            .collect()
    }
}
