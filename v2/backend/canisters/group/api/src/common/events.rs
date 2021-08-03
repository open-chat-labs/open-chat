use candid::CandidType;
use serde::Deserialize;
use shared::types::group_message::Message;
use shared::types::UserId;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum GroupChatEvent {
    Message(Message),
    GroupChatCreated(GroupChatCreated),
    GroupNameChanged(GroupNameChanged),
    GroupDescriptionChanged(GroupDescriptionChanged),
    ParticipantsAdded(ParticipantsAdded),
    ParticipantsRemoved(ParticipantsRemoved),
    ParticipantJoined(ParticipantJoined),
    ParticipantLeft(ParticipantLeft),
    ParticipantsPromotedToAdmin(ParticipantsPromotedToAdmin),
    ParticipantsDismissedAsAdmin(ParticipantsPromotedToAdmin),
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GroupChatCreated {
    pub name: String,
    pub description: Option<String>,
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
    pub new_description: Option<String>,
    pub previous_description: Option<String>,
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
