use crate::{EventIndex, Message, MessageId, MessageIndex, Role, UserId};
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
    ParticipantsPromotedToAdmin(ParticipantsPromotedToAdmin),
    ParticipantsDismissedAsAdmin(ParticipantsDismissedAsAdmin),
    RoleChanged(RoleChanged),
    UsersBlocked(UsersBlocked),
    UsersUnblocked(UsersUnblocked),
    MessageEdited(UpdatedMessage),
    MessageDeleted(UpdatedMessage),
    MessageReactionAdded(UpdatedMessage),
    MessageReactionRemoved(UpdatedMessage),
    PinnedMessageUpdated(PinnedMessageUpdated),
}

impl GroupChatEvent {
    pub fn affected_event(&self) -> Option<EventIndex> {
        match self {
            GroupChatEvent::MessageEdited(m) => Some(m.event_index),
            GroupChatEvent::MessageDeleted(m) => Some(m.event_index),
            GroupChatEvent::MessageReactionAdded(r) => Some(r.event_index),
            GroupChatEvent::MessageReactionRemoved(r) => Some(r.event_index),
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
pub struct ParticipantsPromotedToAdmin {
    pub user_ids: Vec<UserId>,
    pub promoted_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct OwnershipTransferred {
    pub old_owner: UserId,
    pub new_owner: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ParticipantsDismissedAsAdmin {
    pub user_ids: Vec<UserId>,
    pub dismissed_by: UserId,
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
pub struct PinnedMessageUpdated {
    pub new_value: Option<MessageIndex>,
    pub updated_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UpdatedMessage {
    pub updated_by: UserId,
    pub event_index: EventIndex,
    pub message_id: MessageId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum DirectChatEvent {
    Message(Box<Message>),
    DirectChatCreated(DirectChatCreated),
    MessageEdited(UpdatedMessage),
    MessageDeleted(UpdatedMessage),
    MessageReactionAdded(UpdatedMessage),
    MessageReactionRemoved(UpdatedMessage),
}

impl DirectChatEvent {
    pub fn affected_event(&self) -> Option<EventIndex> {
        match self {
            DirectChatEvent::MessageEdited(m) => Some(m.event_index),
            DirectChatEvent::MessageDeleted(m) => Some(m.event_index),
            DirectChatEvent::MessageReactionAdded(r) => Some(r.event_index),
            DirectChatEvent::MessageReactionRemoved(r) => Some(r.event_index),
            _ => None,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug)]
pub struct DirectChatCreated {}
