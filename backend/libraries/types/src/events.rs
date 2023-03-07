use crate::{EventIndex, GroupPermissions, Message, MessageId, MessageIndex, Milliseconds, Role, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ChatEvent {
    Message(Box<Message>),
    GroupChatCreated(GroupChatCreated),
    DirectChatCreated(DirectChatCreated),
    GroupNameChanged(GroupNameChanged),
    GroupDescriptionChanged(GroupDescriptionChanged),
    GroupRulesChanged(GroupRulesChanged),
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
    MessageUndeleted(UpdatedMessage),
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
    ProposalsUpdated(ProposalsUpdated),
    ChatFrozen(ChatFrozen),
    ChatUnfrozen(ChatUnfrozen),
    EventsTimeToLiveUpdated(EventsTimeToLiveUpdated),
}

impl ChatEvent {
    pub fn affected_events(&self) -> Vec<EventIndex> {
        match self {
            ChatEvent::MessageEdited(m) => vec![m.event_index],
            ChatEvent::MessageDeleted(m) => vec![m.event_index],
            ChatEvent::MessageUndeleted(m) => vec![m.event_index],
            ChatEvent::MessageReactionAdded(r) => vec![r.event_index],
            ChatEvent::MessageReactionRemoved(r) => vec![r.event_index],
            ChatEvent::PollVoteRegistered(v) => vec![v.event_index],
            ChatEvent::PollVoteDeleted(v) => vec![v.event_index],
            ChatEvent::PollEnded(p) => vec![p.event_index],
            ChatEvent::ThreadUpdated(t) => vec![t.event_index],
            ChatEvent::ProposalsUpdated(pu) => pu.proposals.iter().map(|p| p.event_index).collect(),
            _ => vec![],
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
    pub existing_vote_removed: bool, // TODO do we need this?
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
    pub event_index: EventIndex,
    pub latest_thread_message_index_if_updated: Option<MessageIndex>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ProposalsUpdated {
    pub proposals: Vec<ProposalUpdated>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ProposalUpdated {
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ChatFrozen {
    pub frozen_by: UserId,
    pub reason: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ChatUnfrozen {
    pub unfrozen_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct EventsTimeToLiveUpdated {
    pub updated_by: UserId,
    pub new_ttl: Option<Milliseconds>,
}

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug)]
pub struct DirectChatCreated {}
