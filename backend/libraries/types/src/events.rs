use crate::{EventIndex, GroupPermissions, Message, MessageId, MessageIndex, Role, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum GroupChatEvent {
    Message(Box<Message>),
    GroupChatCreated(GroupChatCreated),
    GroupNameChanged(GroupNameChanged),
    GroupDescriptionChanged(GroupDescriptionChanged),
    AvatarChanged(AvatarChanged),
    OwnershipTransferred(OwnershipTransferred),
    ParticipantsAdded(ParticipantsAdded),
    ParticipantsRemoved(ParticipantsRemoved),
    ParticipantJoined(ParticipantJoined),
    ParticipantLeft(ParticipantLeft),
    ParticipantAssumesSuperAdmin(ParticipantAssumesSuperAdmin),
    ParticipantDismissedAsSuperAdmin(ParticipantDismissedAsSuperAdmin),
    ParticipantRelinquishesSuperAdmin(ParticipantRelinquishesSuperAdmin),
    RoleChanged(RoleChanged),
    UsersBlocked(UsersBlocked),
    UsersUnblocked(UsersUnblocked),
    MessageEdited(UpdatedMessage),
    MessageDeleted(UpdatedMessage),
    MessageReactionAdded(UpdatedMessage),
    MessageReactionRemoved(UpdatedMessage),
    MessagePinned(MessagePinned),
    MessageUnpinned(MessageUnpinned),
    PollVoteRegistered(UpdatedMessage),
    PollVoteDeleted(UpdatedMessage),
    PollEnded(PollEnded),
    PermissionsChanged(PermissionsChanged),
    GroupVisibilityChanged(GroupVisibilityChanged),
    GroupInviteChanged(GroupInviteChanged),
}

impl GroupChatEvent {
    pub fn affected_event(&self) -> Option<EventIndex> {
        match self {
            GroupChatEvent::MessageEdited(m) => Some(m.event_index),
            GroupChatEvent::MessageDeleted(m) => Some(m.event_index),
            GroupChatEvent::MessageReactionAdded(r) => Some(r.event_index),
            GroupChatEvent::MessageReactionRemoved(r) => Some(r.event_index),
            GroupChatEvent::PollVoteRegistered(v) => Some(v.event_index),
            GroupChatEvent::PollVoteDeleted(v) => Some(v.event_index),
            GroupChatEvent::PollEnded(p) => Some(p.event_index),
            _ => None,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupChatCreated {
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
pub struct AvatarChanged {
    pub new_avatar: Option<u128>,
    pub previous_avatar: Option<u128>,
    pub changed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ParticipantsAdded {
    pub user_ids: Vec<UserId>,
    pub added_by: UserId,
    pub unblocked: Vec<UserId>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ParticipantsRemoved {
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
pub struct ParticipantJoined {
    pub user_id: UserId,
    pub as_super_admin: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ParticipantLeft {
    pub user_id: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct OwnershipTransferred {
    pub old_owner: UserId,
    pub new_owner: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct RoleChanged {
    pub user_ids: Vec<UserId>,
    pub changed_by: UserId,
    pub old_role: Role,
    pub new_role: Role,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ParticipantAssumesSuperAdmin {
    pub user_id: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ParticipantDismissedAsSuperAdmin {
    pub user_id: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ParticipantRelinquishesSuperAdmin {
    pub user_id: UserId,
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
pub struct UpdatedMessage {
    pub updated_by: UserId,
    pub event_index: EventIndex,
    pub message_id: MessageId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PollVoteRegistered {
    pub user_id: UserId,
    pub message_id: MessageId,
    pub existing_vote_removed: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PollEnded {
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PermissionsChanged {
    pub old_permissions: GroupPermissions,
    pub new_permissions: GroupPermissions,
    pub changed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupVisibilityChanged {
    pub now_public: bool,
    pub changed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupInviteChanged {
    pub change: GroupInviteChange,
    pub changed_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum GroupInviteChange {
    Enabled,
    Disabled,
    Reset,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum DirectChatEvent {
    Message(Box<Message>),
    DirectChatCreated(DirectChatCreated),
    MessageEdited(UpdatedMessage),
    MessageDeleted(UpdatedMessage),
    MessageReactionAdded(UpdatedMessage),
    MessageReactionRemoved(UpdatedMessage),
    PollVoteRegistered(UpdatedMessage),
    PollVoteDeleted(UpdatedMessage),
    PollEnded(PollEnded),
}

impl DirectChatEvent {
    pub fn affected_event(&self) -> Option<EventIndex> {
        match self {
            DirectChatEvent::MessageEdited(m) => Some(m.event_index),
            DirectChatEvent::MessageDeleted(m) => Some(m.event_index),
            DirectChatEvent::MessageReactionAdded(r) => Some(r.event_index),
            DirectChatEvent::MessageReactionRemoved(r) => Some(r.event_index),
            DirectChatEvent::PollVoteRegistered(v) => Some(v.event_index),
            DirectChatEvent::PollVoteDeleted(v) => Some(v.event_index),
            DirectChatEvent::PollEnded(p) => Some(p.event_index),
            _ => None,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug)]
pub struct DirectChatCreated {}
