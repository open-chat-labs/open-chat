use std::collections::HashMap;

use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

use crate::{
    AvatarChanged, BannerChanged, BotAdded, BotRemoved, BotUpdated, ChannelDeleted, ChannelId, ChatId, CommunityPermissions,
    CommunityRole, GroupCreated, GroupDescriptionChanged, GroupFrozen, GroupGateUpdated, GroupInviteCodeChanged,
    GroupNameChanged, GroupRulesChanged, GroupUnfrozen, PrimaryLanguageChanged, UserId, UsersInvited, UsersUnblocked,
};

#[derive(CandidType, Serialize, Deserialize, Debug, Clone, Copy, Hash, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u8)]
pub enum CommunityEventCategory {
    Membership = 0, // User added, blocked, invited, role changed, etc.
    Details = 1,    // Name, description, rules, permissions changed, etc.
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Copy, Hash, PartialEq, Eq, PartialOrd, Ord)]
pub enum CommunityEventType {
    // Details category
    Created,
    NameChanged,
    DescriptionChanged,
    RulesChanged,
    AvatarChanged,
    BannerChanged,
    PermissionsChanged,
    VisibilityChanged,
    InviteCodeChanged,
    Frozen,
    Unfrozen,
    EventsTTLUpdated,
    GateUpdated,
    MessagePinned,
    MessageUnpinned,
    PrimaryLanguageChanged,
    GroupImported,
    ChannelCreated,
    ChannelDeleted,

    // Membership category
    MembersJoined,
    MembersLeft,
    RoleChanged,
    UsersInvited,
    BotAdded,
    BotRemoved,
    BotUpdated,
    UsersBlocked,
    UsersUnblocked,
}

impl From<CommunityEventType> for CommunityEventCategory {
    fn from(value: CommunityEventType) -> Self {
        match value {
            CommunityEventType::Created
            | CommunityEventType::NameChanged
            | CommunityEventType::DescriptionChanged
            | CommunityEventType::RulesChanged
            | CommunityEventType::AvatarChanged
            | CommunityEventType::BannerChanged
            | CommunityEventType::PermissionsChanged
            | CommunityEventType::VisibilityChanged
            | CommunityEventType::InviteCodeChanged
            | CommunityEventType::Frozen
            | CommunityEventType::Unfrozen
            | CommunityEventType::EventsTTLUpdated
            | CommunityEventType::GateUpdated
            | CommunityEventType::PrimaryLanguageChanged
            | CommunityEventType::GroupImported
            | CommunityEventType::ChannelCreated
            | CommunityEventType::ChannelDeleted
            | CommunityEventType::MessagePinned
            | CommunityEventType::MessageUnpinned => CommunityEventCategory::Details,
            CommunityEventType::MembersJoined
            | CommunityEventType::MembersLeft
            | CommunityEventType::RoleChanged
            | CommunityEventType::UsersInvited
            | CommunityEventType::BotAdded
            | CommunityEventType::BotRemoved
            | CommunityEventType::BotUpdated
            | CommunityEventType::UsersBlocked
            | CommunityEventType::UsersUnblocked => CommunityEventCategory::Membership,
        }
    }
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CommunityEvent {
    Created(Box<GroupCreated>),
    NameChanged(Box<GroupNameChanged>),
    DescriptionChanged(Box<GroupDescriptionChanged>),
    RulesChanged(Box<GroupRulesChanged>),
    AvatarChanged(Box<AvatarChanged>),
    BannerChanged(Box<BannerChanged>),
    UsersInvited(Box<UsersInvited>),
    MembersRemoved(Box<CommunityMembersRemoved>),
    RoleChanged(Box<CommunityRoleChanged>),
    UsersBlocked(Box<CommunityUsersBlocked>),
    UsersUnblocked(Box<UsersUnblocked>),
    PermissionsChanged(Box<CommunityPermissionsChanged>),
    VisibilityChanged(Box<CommunityVisibilityChanged>),
    InviteCodeChanged(Box<GroupInviteCodeChanged>),
    Frozen(Box<GroupFrozen>),
    Unfrozen(Box<GroupUnfrozen>),
    GateUpdated(Box<GroupGateUpdated>),
    ChannelDeleted(Box<ChannelDeleted>),
    PrimaryLanguageChanged(Box<PrimaryLanguageChanged>),
    GroupImported(Box<GroupImported>),
    BotAdded(Box<BotAdded>),
    BotRemoved(Box<BotRemoved>),
    BotUpdated(Box<BotUpdated>),
    FailedToDeserialize,
}

impl CommunityEvent {
    pub fn event_type(&self) -> Option<CommunityEventType> {
        match self {
            CommunityEvent::Created(_) => Some(CommunityEventType::Created),
            CommunityEvent::NameChanged(_) => Some(CommunityEventType::NameChanged),
            CommunityEvent::DescriptionChanged(_) => Some(CommunityEventType::DescriptionChanged),
            CommunityEvent::RulesChanged(_) => Some(CommunityEventType::RulesChanged),
            CommunityEvent::AvatarChanged(_) => Some(CommunityEventType::AvatarChanged),
            CommunityEvent::BannerChanged(_) => Some(CommunityEventType::BannerChanged),
            CommunityEvent::UsersInvited(_) => Some(CommunityEventType::UsersInvited),
            CommunityEvent::MembersRemoved(_) => Some(CommunityEventType::MembersLeft),
            CommunityEvent::RoleChanged(_) => Some(CommunityEventType::RoleChanged),
            CommunityEvent::UsersBlocked(_) => Some(CommunityEventType::UsersBlocked),
            CommunityEvent::UsersUnblocked(_) => Some(CommunityEventType::UsersUnblocked),
            CommunityEvent::PermissionsChanged(_) => Some(CommunityEventType::PermissionsChanged),
            CommunityEvent::VisibilityChanged(_) => Some(CommunityEventType::VisibilityChanged),
            CommunityEvent::InviteCodeChanged(_) => Some(CommunityEventType::InviteCodeChanged),
            CommunityEvent::Frozen(_) => Some(CommunityEventType::Frozen),
            CommunityEvent::Unfrozen(_) => Some(CommunityEventType::Unfrozen),
            CommunityEvent::GateUpdated(_) => Some(CommunityEventType::GateUpdated),
            CommunityEvent::ChannelDeleted(_) => Some(CommunityEventType::ChannelDeleted),
            CommunityEvent::PrimaryLanguageChanged(_) => Some(CommunityEventType::PrimaryLanguageChanged),
            CommunityEvent::GroupImported(_) => Some(CommunityEventType::GroupImported),
            CommunityEvent::BotAdded(_) => Some(CommunityEventType::BotAdded),
            CommunityEvent::BotRemoved(_) => Some(CommunityEventType::BotRemoved),
            CommunityEvent::BotUpdated(_) => Some(CommunityEventType::BotUpdated),
            CommunityEvent::FailedToDeserialize => None,
        }
    }
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityMembersRemoved {
    pub user_ids: Vec<UserId>,
    pub removed_by: UserId,
    pub referred_by: HashMap<UserId, UserId>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityUsersBlocked {
    pub user_ids: Vec<UserId>,
    pub blocked_by: UserId,
    pub referred_by: HashMap<UserId, UserId>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityPermissionsChanged {
    pub old_permissions: CommunityPermissions,
    pub new_permissions: CommunityPermissions,
    pub changed_by: UserId,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityVisibilityChanged {
    pub now_public: bool,
    pub changed_by: UserId,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityRoleChanged {
    pub user_ids: Vec<UserId>,
    pub changed_by: UserId,
    pub old_role: CommunityRole,
    pub new_role: CommunityRole,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupImported {
    pub group_id: ChatId,
    pub channel_id: ChannelId,
}
