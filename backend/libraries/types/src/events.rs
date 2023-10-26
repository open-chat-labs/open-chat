use crate::{
    AccessGate, ChannelId, CommunityPermissions, CommunityRole, EventIndex, EventWrapper, GroupPermissionRole,
    GroupPermissions, GroupPermissionsPrevious, GroupRole, Message, MessageIndex, MessagePermissions, Milliseconds,
    TimestampMillis, UserId,
};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ChatEvent {
    Empty,
    Message(Box<Message>),
    GroupChatCreated(GroupCreated),
    DirectChatCreated(DirectChatCreated),
    GroupNameChanged(GroupNameChanged),
    GroupDescriptionChanged(GroupDescriptionChanged),
    GroupRulesChanged(GroupRulesChanged),
    AvatarChanged(AvatarChanged),
    ParticipantsAdded(MembersAdded),
    ParticipantsRemoved(MembersRemoved),
    ParticipantJoined(MemberJoined),
    ParticipantLeft(MemberLeft),
    RoleChanged(RoleChanged),
    UsersBlocked(UsersBlocked),
    UsersUnblocked(UsersUnblocked),
    MessagePinned(MessagePinned),
    MessageUnpinned(MessageUnpinned),
    PermissionsChanged(PermissionsChanged),
    GroupVisibilityChanged(GroupVisibilityChanged),
    GroupInviteCodeChanged(GroupInviteCodeChanged),
    ChatFrozen(GroupFrozen),
    ChatUnfrozen(GroupUnfrozen),
    EventsTimeToLiveUpdated(EventsTimeToLiveUpdated),
    GroupGateUpdated(GroupGateUpdated),
    UsersInvited(UsersInvited),
    MembersAddedToDefaultChannel(MembersAddedToDefaultChannel),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct EventsResponse {
    pub events: Vec<EventWrapper<ChatEvent>>,
    pub expired_event_ranges: Vec<(EventIndex, EventIndex)>,
    pub expired_message_ranges: Vec<(MessageIndex, MessageIndex)>,
    pub latest_event_index: EventIndex,
    pub timestamp: TimestampMillis,
}

#[allow(clippy::large_enum_variant)]
pub enum EventOrExpiredRange {
    Event(EventWrapper<ChatEvent>),
    ExpiredEventRange(EventIndex, EventIndex),
}

impl EventOrExpiredRange {
    pub fn as_event(&self) -> Option<&EventWrapper<ChatEvent>> {
        if let EventOrExpiredRange::Event(event) = self {
            Some(event)
        } else {
            None
        }
    }

    pub fn split(
        events_and_expired_ranges: Vec<EventOrExpiredRange>,
    ) -> (Vec<EventWrapper<ChatEvent>>, Vec<(EventIndex, EventIndex)>) {
        let mut events = Vec::new();
        let mut expired_ranges = Vec::new();

        for event_or_expired_range in events_and_expired_ranges {
            match event_or_expired_range {
                EventOrExpiredRange::Event(e) => events.push(e),
                EventOrExpiredRange::ExpiredEventRange(from, to) => expired_ranges.push((from, to)),
            }
        }

        expired_ranges.sort();

        (events, expired_ranges)
    }
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct MessagesResponse {
    pub messages: Vec<EventWrapper<Message>>,
    pub latest_event_index: EventIndex,
    pub timestamp: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupCreated {
    pub name: String,
    pub description: String,
    pub created_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupNameChanged {
    pub new_name: String,
    pub previous_name: String,
    pub changed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupDescriptionChanged {
    pub new_description: String,
    pub previous_description: String,
    pub changed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupRulesChanged {
    pub enabled: bool,
    pub prev_enabled: bool,
    pub changed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AvatarChanged {
    pub new_avatar: Option<u128>,
    pub previous_avatar: Option<u128>,
    pub changed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct BannerChanged {
    pub new_banner: Option<u128>,
    pub previous_banner: Option<u128>,
    pub changed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MembersAdded {
    pub user_ids: Vec<UserId>,
    pub added_by: UserId,
    pub unblocked: Vec<UserId>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MembersRemoved {
    pub user_ids: Vec<UserId>,
    pub removed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UsersBlocked {
    pub user_ids: Vec<UserId>,
    pub blocked_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UsersUnblocked {
    pub user_ids: Vec<UserId>,
    pub unblocked_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MemberJoined {
    pub user_id: UserId,
    pub invited_by: Option<UserId>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MemberLeft {
    pub user_id: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct RoleChanged {
    pub user_ids: Vec<UserId>,
    pub changed_by: UserId,
    pub old_role: GroupRole,
    pub new_role: GroupRole,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityRoleChanged {
    pub user_ids: Vec<UserId>,
    pub changed_by: UserId,
    pub old_role: CommunityRole,
    pub new_role: CommunityRole,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MessagePinned {
    pub message_index: MessageIndex,
    pub pinned_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MessageUnpinned {
    pub message_index: MessageIndex,
    pub unpinned_by: UserId,
    pub due_to_message_deleted: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PermissionsChangedCombined {
    pub old_permissions: GroupPermissionsPrevious,
    pub new_permissions: GroupPermissionsPrevious,
    #[serde(default = "group_permissions_none")]
    pub old_permissions_v2: GroupPermissions,
    #[serde(default = "group_permissions_none")]
    pub new_permissions_v2: GroupPermissions,
    pub changed_by: UserId,
}

fn group_permissions_none() -> GroupPermissions {
    GroupPermissions {
        change_roles: GroupPermissionRole::None,
        update_group: GroupPermissionRole::None,
        add_members: GroupPermissionRole::None,
        invite_users: GroupPermissionRole::None,
        remove_members: GroupPermissionRole::None,
        delete_messages: GroupPermissionRole::None,
        pin_messages: GroupPermissionRole::None,
        react_to_messages: GroupPermissionRole::None,
        mention_all_members: GroupPermissionRole::None,
        message_permissions: MessagePermissions::default(),
        thread_permissions: None,
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
#[serde(from = "PermissionsChangedCombined")]
pub struct PermissionsChanged {
    pub old_permissions: GroupPermissionsPrevious,
    pub new_permissions: GroupPermissionsPrevious,
    pub old_permissions_v2: GroupPermissions,
    pub new_permissions_v2: GroupPermissions,
    pub changed_by: UserId,
}

impl From<PermissionsChangedCombined> for PermissionsChanged {
    #[allow(deprecated)]
    fn from(value: PermissionsChangedCombined) -> Self {
        if value.old_permissions_v2.change_roles == GroupPermissionRole::None {
            PermissionsChanged {
                old_permissions: value.old_permissions.clone(),
                new_permissions: value.new_permissions.clone(),
                old_permissions_v2: value.old_permissions.into(),
                new_permissions_v2: value.new_permissions.into(),
                changed_by: value.changed_by,
            }
        } else {
            PermissionsChanged {
                old_permissions: value.old_permissions,
                new_permissions: value.new_permissions,
                old_permissions_v2: value.old_permissions_v2,
                new_permissions_v2: value.new_permissions_v2,
                changed_by: value.changed_by,
            }
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CommunityPermissionsChanged {
    pub old_permissions: CommunityPermissions,
    pub new_permissions: CommunityPermissions,
    pub changed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupVisibilityChanged {
    pub now_public: bool,
    pub changed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupInviteCodeChanged {
    pub change: GroupInviteCodeChange,
    pub changed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum GroupInviteCodeChange {
    Enabled,
    Disabled,
    Reset,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupFrozen {
    pub frozen_by: UserId,
    pub reason: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupUnfrozen {
    pub unfrozen_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct EventsTimeToLiveUpdated {
    pub updated_by: UserId,
    pub new_ttl: Option<Milliseconds>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupGateUpdated {
    pub updated_by: UserId,
    pub new_gate: Option<AccessGate>,
}

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug)]
pub struct DirectChatCreated {}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UsersInvited {
    pub user_ids: Vec<UserId>,
    pub invited_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ChannelDeleted {
    pub channel_id: ChannelId,
    pub name: String,
    pub deleted_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DefaultChannelsChanged {
    pub added: Vec<ChannelId>,
    pub removed: Vec<ChannelId>,
    pub changed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PrimaryLanguageChanged {
    pub previous: String,
    pub new: String,
    pub changed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MembersAddedToDefaultChannel {
    pub count: u32,
}
