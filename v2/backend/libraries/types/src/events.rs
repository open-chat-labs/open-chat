use crate::message::{DirectMessage, GroupMessage};
use crate::{DeletedDirectMessage, DeletedGroupMessage, EventIndex, MessageId, UserId};
use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum GroupChatEvent {
    Message(GroupMessage),
    DeletedMessage(DeletedGroupMessage),
    GroupChatCreated(GroupChatCreated),
    GroupNameChanged(GroupNameChanged),
    GroupDescriptionChanged(GroupDescriptionChanged),
    AvatarChanged(AvatarChanged),
    ParticipantsAdded(ParticipantsAdded),
    ParticipantsRemoved(ParticipantsRemoved),
    ParticipantJoined(ParticipantJoined),
    ParticipantLeft(ParticipantLeft),
    ParticipantsPromotedToAdmin(ParticipantsPromotedToAdmin),
    ParticipantsDismissedAsAdmin(ParticipantsDismissedAsAdmin),
    UsersBlocked(UsersBlocked),
    UsersUnblocked(UsersUnblocked),
    MessageDeleted(UpdatedMessage),
    MessageReactionAdded(UpdatedMessage),
    MessageReactionRemoved(UpdatedMessage),
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GroupChatCreated {
    pub name: String,
    pub description: String,
    pub created_by: UserId,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GroupNameChanged {
    pub new_name: String,
    pub previous_name: String,
    pub changed_by: UserId,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GroupDescriptionChanged {
    pub new_description: String,
    pub previous_description: String,
    pub changed_by: UserId,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct AvatarChanged {
    pub new_avatar: u128,
    pub previous_avatar: Option<u128>,
    pub changed_by: UserId,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct ParticipantsAdded {
    pub user_ids: Vec<UserId>,
    pub added_by: UserId,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct ParticipantsRemoved {
    pub user_ids: Vec<UserId>,
    pub removed_by: UserId,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct UsersBlocked {
    pub user_ids: Vec<UserId>,
    pub blocked_by: UserId,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct UsersUnblocked {
    pub user_ids: Vec<UserId>,
    pub unblocked_by: UserId,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct ParticipantJoined {
    pub user_id: UserId,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct ParticipantLeft {
    pub user_id: UserId,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct ParticipantsPromotedToAdmin {
    pub user_ids: Vec<UserId>,
    pub promoted_by: UserId,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct ParticipantsDismissedAsAdmin {
    pub user_ids: Vec<UserId>,
    pub dismissed_by: UserId,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct UpdatedMessage {
    pub event_index: EventIndex,
    pub message_id: MessageId,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum DirectChatEvent {
    Message(DirectMessage),
    DeletedMessage(DeletedDirectMessage),
    DirectChatCreated(DirectChatCreated),
    MessageDeleted(UpdatedMessage),
    MessageReactionAdded(UpdatedMessage),
    MessageReactionRemoved(UpdatedMessage),
}

#[derive(CandidType, Deserialize, Copy, Clone, Debug)]
pub struct DirectChatCreated {}
