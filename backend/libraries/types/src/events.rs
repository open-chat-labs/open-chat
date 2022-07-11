use crate::{EventIndex, GroupPermissions, Message, MessageId, MessageIndex, Role, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ChatEvent {
    Message(Box<Message>),
    GroupChatCreated(GroupChatCreated),
    DirectChatCreated(DirectChatCreated),
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
    GroupInviteCodeChanged(GroupInviteCodeChanged),
    ThreadUpdated(ThreadUpdated),
}

impl ChatEvent {
    pub fn affected_event(&self) -> Option<EventIndex> {
        match self {
            ChatEvent::MessageEdited(m) => Some(m.event_index),
            ChatEvent::MessageDeleted(m) => Some(m.event_index),
            ChatEvent::MessageReactionAdded(r) => Some(r.event_index),
            ChatEvent::MessageReactionRemoved(r) => Some(r.event_index),
            ChatEvent::PollVoteRegistered(v) => Some(v.event_index),
            ChatEvent::PollVoteDeleted(v) => Some(v.event_index),
            ChatEvent::PollEnded(p) => Some(p.event_index),
            ChatEvent::ThreadUpdated(t) => Some(t.event_index),
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
pub struct ThreadUpdated {
    pub message_index: MessageIndex,
    pub new_message: bool,
    pub event_index: EventIndex,
    pub latest_thread_message_index_update: Option<MessageIndex>,
}

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug)]
pub struct DirectChatCreated {}
