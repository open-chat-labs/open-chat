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

// TODO: remove this after communities and groups next released
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct GroupPermissionsPrevious {
    #[deprecated]
    #[serde(default = "group_permission_role_owner")]
    pub change_permissions: GroupPermissionRole,
    pub change_roles: GroupPermissionRole,
    pub update_group: GroupPermissionRole,
    pub add_members: GroupPermissionRole,
    pub invite_users: GroupPermissionRole,
    pub remove_members: GroupPermissionRole,
    #[deprecated]
    #[serde(default = "group_permission_role_owner")]
    pub block_users: GroupPermissionRole,
    pub delete_messages: GroupPermissionRole,
    pub pin_messages: GroupPermissionRole,
    pub create_polls: GroupPermissionRole,
    pub send_messages: GroupPermissionRole,
    pub react_to_messages: GroupPermissionRole,
    pub reply_in_thread: GroupPermissionRole,
    pub mention_all_members: GroupPermissionRole,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
// TODO: remove this serde attribute after communities and groups next released
#[serde(from = "GroupPermissionsCombined")]
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
pub struct GroupPermissionsCombined {
    pub change_roles: GroupPermissionRole,
    pub update_group: GroupPermissionRole,
    pub add_members: GroupPermissionRole,
    pub invite_users: GroupPermissionRole,
    pub remove_members: GroupPermissionRole,
    pub delete_messages: GroupPermissionRole,
    pub pin_messages: GroupPermissionRole,
    pub react_to_messages: GroupPermissionRole,
    pub mention_all_members: GroupPermissionRole,

    #[serde(default = "default_group_permission_role")]
    pub change_permissions: GroupPermissionRole,
    #[serde(default = "default_group_permission_role")]
    pub block_users: GroupPermissionRole,
    #[serde(default = "default_group_permission_role")]
    pub create_polls: GroupPermissionRole,
    #[serde(default = "default_group_permission_role")]
    pub send_messages: GroupPermissionRole,
    #[serde(default = "default_group_permission_role")]
    pub reply_in_thread: GroupPermissionRole,
    #[serde(default)]
    pub message_permissions: MessagePermissions,
    #[serde(default)]
    pub thread_permissions: Option<MessagePermissions>,
}

fn default_group_permission_role() -> GroupPermissionRole {
    GroupPermissionRole::None
}

// TODO: remove this after communities and groups next released
impl From<GroupPermissionsPrevious> for GroupPermissions {
    fn from(value: GroupPermissionsPrevious) -> Self {
        GroupPermissions {
            change_roles: value.change_roles,
            update_group: value.update_group,
            add_members: value.add_members,
            invite_users: value.invite_users,
            remove_members: value.remove_members,
            delete_messages: value.delete_messages,
            pin_messages: value.pin_messages,
            react_to_messages: value.react_to_messages,
            mention_all_members: value.mention_all_members,
            message_permissions: MessagePermissions {
                default: value.send_messages,
                poll: if !value.create_polls.equals(&value.send_messages) { Some(value.create_polls) } else { None },
                ..Default::default()
            },
            thread_permissions: if value.reply_in_thread.equals(&value.send_messages) {
                None
            } else {
                Some(MessagePermissions {
                    default: value.reply_in_thread,
                    poll: if value.create_polls.gte(&value.reply_in_thread) { Some(value.create_polls) } else { None },
                    ..Default::default()
                })
            },
        }
    }
}

// TODO: remove this after communities and groups next released
impl From<GroupPermissionsCombined> for GroupPermissions {
    #[allow(deprecated)]
    fn from(value: GroupPermissionsCombined) -> Self {
        if value.create_polls.equals(&GroupPermissionRole::None) {
            // GroupPermissionsPrevious will never have any permission roles == None
            // so we reason the source type was in fact GroupPermissionsPrevious
            let previous = GroupPermissionsPrevious {
                change_permissions: value.change_permissions,
                change_roles: value.change_roles,
                update_group: value.update_group,
                add_members: value.add_members,
                invite_users: value.invite_users,
                remove_members: value.remove_members,
                block_users: value.block_users,
                delete_messages: value.delete_messages,
                pin_messages: value.pin_messages,
                create_polls: value.create_polls,
                send_messages: value.send_messages,
                react_to_messages: value.react_to_messages,
                reply_in_thread: value.reply_in_thread,
                mention_all_members: value.mention_all_members,
            };
            previous.into()
        } else {
            // Otherwise we reason the source type was in fact GroupPermissions
            GroupPermissions {
                change_roles: value.change_roles,
                update_group: value.update_group,
                add_members: value.add_members,
                invite_users: value.invite_users,
                remove_members: value.remove_members,
                delete_messages: value.delete_messages,
                pin_messages: value.pin_messages,
                react_to_messages: value.react_to_messages,
                mention_all_members: value.mention_all_members,
                message_permissions: value.message_permissions,
                thread_permissions: value.thread_permissions,
            }
        }
    }
}

// TODO: remove this after communities and groups next released
impl From<OptionalGroupPermissionsPrevious> for OptionalGroupPermissions {
    fn from(value: OptionalGroupPermissionsPrevious) -> Self {
        let message_permissions = if value.send_messages.is_none() && value.create_polls.is_none() {
            None
        } else {
            Some(OptionalMessagePermissions::new(
                value.send_messages,
                match value.create_polls {
                    Some(r) => OptionUpdate::SetToSome(r),
                    None => OptionUpdate::NoChange,
                },
            ))
        };

        let thread_permissions = match value.reply_in_thread {
            Some(r) => OptionUpdate::SetToSome(OptionalMessagePermissions::new(Some(r), OptionUpdate::NoChange)),
            None => OptionUpdate::NoChange,
        };

        OptionalGroupPermissions {
            change_roles: value.change_roles,
            update_group: value.update_group,
            invite_users: value.invite_users,
            remove_members: value.remove_members,
            delete_messages: value.delete_messages,
            pin_messages: value.pin_messages,
            react_to_messages: value.react_to_messages,
            mention_all_members: value.mention_all_members,
            message_permissions,
            thread_permissions,
        }
    }
}

// TODO: remove this after communities and groups next released
impl From<GroupPermissions> for GroupPermissionsPrevious {
    #[allow(deprecated)]
    fn from(value: GroupPermissions) -> Self {
        let send_messages = value.message_permissions.text.unwrap_or(value.message_permissions.default);
        let create_polls = value.message_permissions.poll.unwrap_or(value.message_permissions.default);
        let reply_in_thread = value
            .thread_permissions
            .map(|tps| tps.text.unwrap_or(tps.default))
            .unwrap_or(send_messages);

        GroupPermissionsPrevious {
            change_permissions: GroupPermissionRole::Owner,
            change_roles: value.change_roles,
            update_group: value.update_group,
            add_members: value.add_members,
            invite_users: value.invite_users,
            remove_members: value.remove_members,
            block_users: GroupPermissionRole::Owner,
            delete_messages: value.delete_messages,
            pin_messages: value.pin_messages,
            react_to_messages: value.react_to_messages,
            mention_all_members: value.mention_all_members,
            send_messages,
            create_polls,
            reply_in_thread,
        }
    }
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

impl OptionalMessagePermissions {
    fn new(default: Option<GroupPermissionRole>, poll: OptionUpdate<GroupPermissionRole>) -> OptionalMessagePermissions {
        OptionalMessagePermissions {
            default,
            text: OptionUpdate::NoChange,
            image: OptionUpdate::NoChange,
            video: OptionUpdate::NoChange,
            audio: OptionUpdate::NoChange,
            file: OptionUpdate::NoChange,
            poll,
            crypto: OptionUpdate::NoChange,
            giphy: OptionUpdate::NoChange,
            prize: OptionUpdate::NoChange,
            custom_updated: Vec::new(),
            custom_deleted: Vec::new(),
        }
    }
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

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct OptionalGroupPermissionsPrevious {
    #[deprecated]
    pub change_permissions: Option<GroupPermissionRole>,
    pub change_roles: Option<GroupPermissionRole>,
    pub update_group: Option<GroupPermissionRole>,
    pub invite_users: Option<GroupPermissionRole>,
    pub remove_members: Option<GroupPermissionRole>,
    #[deprecated]
    pub block_users: Option<GroupPermissionRole>,
    pub delete_messages: Option<GroupPermissionRole>,
    pub pin_messages: Option<GroupPermissionRole>,
    pub create_polls: Option<GroupPermissionRole>,
    pub send_messages: Option<GroupPermissionRole>,
    pub react_to_messages: Option<GroupPermissionRole>,
    pub reply_in_thread: Option<GroupPermissionRole>,
    pub mention_all_members: Option<GroupPermissionRole>,
}

impl Default for GroupPermissionsPrevious {
    #[allow(deprecated)]
    fn default() -> Self {
        GroupPermissionsPrevious {
            change_permissions: GroupPermissionRole::Owner,
            change_roles: GroupPermissionRole::Admins,
            add_members: GroupPermissionRole::Admins,
            mention_all_members: GroupPermissionRole::Admins,
            remove_members: GroupPermissionRole::Moderators,
            block_users: GroupPermissionRole::Owner,
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

fn group_permission_role_owner() -> GroupPermissionRole {
    GroupPermissionRole::Owner
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn check_conversion_permutations() {
        let roles = [
            GroupPermissionRole::None,
            GroupPermissionRole::Owner,
            GroupPermissionRole::Admins,
            GroupPermissionRole::Moderators,
            GroupPermissionRole::Members,
        ];

        let mut old = GroupPermissionsPrevious::default();

        for send in 0..5 {
            for reply in 0..5 {
                for poll in 0..5 {
                    old.send_messages = roles[send];
                    old.reply_in_thread = roles[reply];
                    old.create_polls = roles[poll];
                    check_conversion_of_permissions(&old);
                }
            }
        }
    }

    fn check_conversion_of_permissions(old: &GroupPermissionsPrevious) {
        let new: GroupPermissions = old.clone().into();
        let old_prime: GroupPermissionsPrevious = new.into();
        assert_eq!(&old_prime, old);
    }
}
