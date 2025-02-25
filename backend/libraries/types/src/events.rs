use crate::{
    AccessGate, AccessGateConfig, BotCommand, ChannelId, CommunityPermissions, CommunityRole, EventIndex, EventWrapper,
    EventsCaller, GroupPermissions, GroupRole, Message, MessageIndex, Milliseconds, TimestampMillis, UserId,
};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use ts_export::ts_export;

#[ts_export]
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
    ExternalUrlUpdated(ExternalUrlUpdated),
    BotAdded(Box<BotAdded>),
    BotRemoved(Box<BotRemoved>),
    BotUpdated(Box<BotUpdated>),
    FailedToDeserialize,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone, Copy, Hash, PartialEq, Eq)]
#[repr(u8)]
pub enum ChatEventType {
    Message = 0,            // Messages + edits, reaction, tips, etc.
    MembershipUpdated = 1,  // User added, blocked, invited, role changed, etc.
    ChatDetailsUpdated = 2, // Name, description, rules, permissions changed, etc.
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct EventsResponse {
    #[ts(as = "Vec<crate::EventWrapperChatEvent>")]
    pub events: Vec<EventWrapper<ChatEvent>>,
    pub unauthorized: Vec<EventIndex>,
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

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct MessagesResponse {
    #[ts(as = "Vec<crate::EventWrapperMessage>")]
    pub messages: Vec<EventWrapper<Message>>,
    pub latest_event_index: EventIndex,
    pub chat_last_updated: TimestampMillis,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupCreated {
    pub name: String,
    pub description: String,
    pub created_by: UserId,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupNameChanged {
    pub new_name: String,
    pub previous_name: String,
    pub changed_by: UserId,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupDescriptionChanged {
    pub new_description: String,
    pub previous_description: String,
    pub changed_by: UserId,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupRulesChanged {
    pub enabled: bool,
    pub prev_enabled: bool,
    pub changed_by: UserId,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AvatarChanged {
    pub new_avatar: Option<u128>,
    pub previous_avatar: Option<u128>,
    pub changed_by: UserId,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct BannerChanged {
    pub new_banner: Option<u128>,
    pub previous_banner: Option<u128>,
    pub changed_by: UserId,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MembersAdded {
    pub user_ids: Vec<UserId>,
    pub added_by: UserId,
    pub unblocked: Vec<UserId>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MembersRemoved {
    pub user_ids: Vec<UserId>,
    pub removed_by: UserId,
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
pub struct UsersBlocked {
    pub user_ids: Vec<UserId>,
    pub blocked_by: UserId,
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
pub struct UsersUnblocked {
    pub user_ids: Vec<UserId>,
    pub unblocked_by: UserId,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MemberJoined {
    pub user_id: UserId,
    pub invited_by: Option<UserId>,
}

// The aliases need to be kept to handle pre-existing values
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MemberJoinedInternal {
    #[serde(rename = "u", alias = "user_id")]
    pub user_id: UserId,
    #[serde(rename = "i", alias = "invited_by", skip_serializing_if = "Option::is_none")]
    pub invited_by: Option<UserId>,
}

impl From<MemberJoined> for MemberJoinedInternal {
    fn from(value: MemberJoined) -> Self {
        MemberJoinedInternal {
            user_id: value.user_id,
            invited_by: value.invited_by,
        }
    }
}

impl From<MemberJoinedInternal> for MemberJoined {
    fn from(value: MemberJoinedInternal) -> Self {
        MemberJoined {
            user_id: value.user_id,
            invited_by: value.invited_by,
        }
    }
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MemberLeft {
    pub user_id: UserId,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CommunityMemberLeftInternal {
    #[serde(rename = "u", alias = "user_id")]
    pub user_id: UserId,
    #[serde(rename = "r", alias = "referred_by", skip_serializing_if = "Option::is_none")]
    pub referred_by: Option<UserId>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct RoleChanged {
    pub user_ids: Vec<UserId>,
    pub changed_by: UserId,
    pub old_role: GroupRole,
    pub new_role: GroupRole,
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
pub struct MessagePinned {
    pub message_index: MessageIndex,
    pub pinned_by: UserId,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MessageUnpinned {
    pub message_index: MessageIndex,
    pub unpinned_by: UserId,
    pub due_to_message_deleted: bool,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PermissionsChanged {
    pub old_permissions_v2: GroupPermissions,
    pub new_permissions_v2: GroupPermissions,
    pub changed_by: UserId,
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
pub struct GroupVisibilityChanged {
    pub public: Option<bool>,
    pub messages_visible_to_non_members: Option<bool>,
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
pub struct GroupInviteCodeChanged {
    pub change: GroupInviteCodeChange,
    pub changed_by: UserId,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum GroupInviteCodeChange {
    Enabled,
    Disabled,
    Reset,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupFrozen {
    pub frozen_by: UserId,
    pub reason: Option<String>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupUnfrozen {
    pub unfrozen_by: UserId,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct EventsTimeToLiveUpdated {
    pub updated_by: UserId,
    pub new_ttl: Option<Milliseconds>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupGateUpdated {
    pub updated_by: UserId,
    pub new_gate: Option<AccessGate>,
    pub new_gate_config: Option<AccessGateConfig>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ExternalUrlUpdated {
    pub updated_by: UserId,
    pub new_url: Option<String>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug)]
pub struct DirectChatCreated {}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UsersInvited {
    pub user_ids: Vec<UserId>,
    pub invited_by: UserId,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ChannelDeleted {
    pub channel_id: ChannelId,
    pub name: String,
    pub deleted_by: UserId,
    pub bot_command: Option<BotCommand>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DefaultChannelsChanged {
    pub added: Vec<ChannelId>,
    pub removed: Vec<ChannelId>,
    pub changed_by: UserId,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PrimaryLanguageChanged {
    pub previous: String,
    pub new: String,
    pub changed_by: UserId,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
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

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct EventContext {
    pub thread_root_message_index: Option<MessageIndex>,
    pub event_index: EventIndex,
}

impl EventContext {
    pub fn new(thread_root_message_index: Option<MessageIndex>, event_index: EventIndex) -> EventContext {
        EventContext {
            thread_root_message_index,
            event_index,
        }
    }
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct BotAdded {
    pub user_id: UserId,
    pub added_by: UserId,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct BotRemoved {
    pub user_id: UserId,
    pub removed_by: UserId,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct BotUpdated {
    pub user_id: UserId,
    pub updated_by: UserId,
}

impl ChatEvent {
    pub fn remove_unauthorized_events(caller: &EventsCaller, events: &mut Vec<EventWrapper<ChatEvent>>) -> Vec<EventIndex> {
        let mut unauthorized = Vec::new();
        if let EventsCaller::Bot(bot) = caller {
            events.retain(|event| {
                if event.event.event_type().is_some_and(|t| bot.event_types.contains(&t)) {
                    true
                } else {
                    unauthorized.push(event.index);
                    false
                }
            })
        }
        unauthorized
    }

    pub fn event_type(&self) -> Option<ChatEventType> {
        match self {
            ChatEvent::Message(_) => Some(ChatEventType::Message),
            ChatEvent::GroupChatCreated(_)
            | ChatEvent::DirectChatCreated(_)
            | ChatEvent::GroupNameChanged(_)
            | ChatEvent::GroupDescriptionChanged(_)
            | ChatEvent::GroupRulesChanged(_)
            | ChatEvent::AvatarChanged(_)
            | ChatEvent::MessagePinned(_)
            | ChatEvent::MessageUnpinned(_)
            | ChatEvent::PermissionsChanged(_)
            | ChatEvent::GroupVisibilityChanged(_)
            | ChatEvent::GroupInviteCodeChanged(_)
            | ChatEvent::ChatFrozen(_)
            | ChatEvent::ChatUnfrozen(_)
            | ChatEvent::EventsTimeToLiveUpdated(_)
            | ChatEvent::GroupGateUpdated(_)
            | ChatEvent::ExternalUrlUpdated(_) => Some(ChatEventType::ChatDetailsUpdated),
            ChatEvent::ParticipantsAdded(_)
            | ChatEvent::ParticipantsRemoved(_)
            | ChatEvent::ParticipantJoined(_)
            | ChatEvent::ParticipantLeft(_)
            | ChatEvent::RoleChanged(_)
            | ChatEvent::UsersBlocked(_)
            | ChatEvent::UsersUnblocked(_)
            | ChatEvent::UsersInvited(_)
            | ChatEvent::MembersAddedToDefaultChannel(_)
            | ChatEvent::BotAdded(_)
            | ChatEvent::BotRemoved(_)
            | ChatEvent::BotUpdated(_) => Some(ChatEventType::MembershipUpdated),
            ChatEvent::Empty | ChatEvent::FailedToDeserialize => None,
        }
    }
}
