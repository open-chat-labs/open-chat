use crate::{
    AccessGate, ChannelId, CommunityPermissions, CommunityRole, EventIndex, EventWrapper, GroupPermissions, GroupRole, Message,
    MessageIndex, Milliseconds, TimestampMillis, UserId,
};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
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

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export)]
pub struct EventsResponse {
    pub events: Vec<EventWrapper<ChatEvent>>,
    pub expired_event_ranges: Vec<(EventIndex, EventIndex)>,
    pub expired_message_ranges: Vec<(MessageIndex, MessageIndex)>,
    pub latest_event_index: EventIndex,
    pub chat_last_updated: TimestampMillis,
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

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export)]
pub struct MessagesResponse {
    pub messages: Vec<EventWrapper<Message>>,
    pub latest_event_index: EventIndex,
    pub chat_last_updated: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct GroupCreated {
    pub name: String,
    pub description: String,
    pub created_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct GroupNameChanged {
    pub new_name: String,
    pub previous_name: String,
    pub changed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct GroupDescriptionChanged {
    pub new_description: String,
    pub previous_description: String,
    pub changed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct GroupRulesChanged {
    pub enabled: bool,
    pub prev_enabled: bool,
    pub changed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct AvatarChanged {
    pub new_avatar: Option<u128>,
    pub previous_avatar: Option<u128>,
    pub changed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct BannerChanged {
    pub new_banner: Option<u128>,
    pub previous_banner: Option<u128>,
    pub changed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct MembersAdded {
    pub user_ids: Vec<UserId>,
    pub added_by: UserId,
    pub unblocked: Vec<UserId>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct MembersRemoved {
    pub user_ids: Vec<UserId>,
    pub removed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct UsersBlocked {
    pub user_ids: Vec<UserId>,
    pub blocked_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct UsersUnblocked {
    pub user_ids: Vec<UserId>,
    pub unblocked_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct MemberJoined {
    pub user_id: UserId,
    pub invited_by: Option<UserId>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct MemberLeft {
    pub user_id: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct RoleChanged {
    pub user_ids: Vec<UserId>,
    pub changed_by: UserId,
    pub old_role: GroupRole,
    pub new_role: GroupRole,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct CommunityRoleChanged {
    pub user_ids: Vec<UserId>,
    pub changed_by: UserId,
    pub old_role: CommunityRole,
    pub new_role: CommunityRole,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct MessagePinned {
    pub message_index: MessageIndex,
    pub pinned_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct MessageUnpinned {
    pub message_index: MessageIndex,
    pub unpinned_by: UserId,
    pub due_to_message_deleted: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct PermissionsChanged {
    pub old_permissions_v2: GroupPermissions,
    pub new_permissions_v2: GroupPermissions,
    pub changed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct CommunityPermissionsChanged {
    pub old_permissions: CommunityPermissions,
    pub new_permissions: CommunityPermissions,
    pub changed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct GroupVisibilityChanged {
    pub public: Option<bool>,
    pub messages_visible_to_non_members: Option<bool>,
    pub changed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct CommunityVisibilityChanged {
    pub now_public: bool,
    pub changed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct GroupInviteCodeChanged {
    pub change: GroupInviteCodeChange,
    pub changed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub enum GroupInviteCodeChange {
    Enabled,
    Disabled,
    Reset,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct GroupFrozen {
    pub frozen_by: UserId,
    pub reason: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct GroupUnfrozen {
    pub unfrozen_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct EventsTimeToLiveUpdated {
    pub updated_by: UserId,
    pub new_ttl: Option<Milliseconds>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct GroupGateUpdated {
    pub updated_by: UserId,
    pub new_gate: Option<AccessGate>,
}

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug, TS)]
#[ts(export)]
pub struct DirectChatCreated {}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct UsersInvited {
    pub user_ids: Vec<UserId>,
    pub invited_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct ChannelDeleted {
    pub channel_id: ChannelId,
    pub name: String,
    pub deleted_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct DefaultChannelsChanged {
    pub added: Vec<ChannelId>,
    pub removed: Vec<ChannelId>,
    pub changed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct PrimaryLanguageChanged {
    pub previous: String,
    pub new: String,
    pub changed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct MembersAddedToDefaultChannel {
    pub count: u32,
}

#[derive(Serialize)]
pub struct GroupCreatedEventPayload {
    pub public: bool,
    pub gate: Option<String>,
    pub rules_enabled: bool,
}

#[derive(Serialize)]
pub struct CommunityCreatedEventPayload {
    pub public: bool,
    pub gate: Option<String>,
    pub rules_enabled: bool,
    pub channels: u32,
}

#[derive(Serialize)]
pub struct VideoCallEndedEventPayload {
    pub chat_type: String,
    pub chat_id: String,
    pub participants: u32,
    pub hidden: u32,
    pub duration_secs: u32,
}
