use crate::{
    CommunityPermissions, CommunityRole, EventIndex, EventWrapper, GroupGate, GroupPermissions, GroupRole, Message, MessageId,
    MessageIndex, Milliseconds, TimestampMillis, UserId,
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
    OwnershipTransferred(OwnershipTransferred),
    ParticipantsAdded(MembersAdded),
    ParticipantsRemoved(MembersRemoved),
    ParticipantJoined(MemberJoined),
    ParticipantLeft(MemberLeft),
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
    ChatFrozen(GroupFrozen),
    ChatUnfrozen(GroupUnfrozen),
    EventsTimeToLiveUpdated(EventsTimeToLiveUpdated),
    GroupGateUpdated(GroupGateUpdated),
    UsersInvited(UsersInvited),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct EventsResponse {
    pub events: Vec<EventWrapper<ChatEvent>>,
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
pub struct OwnershipTransferred {
    pub old_owner: UserId,
    pub new_owner: UserId,
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
    pub new_gate: Option<GroupGate>,
}

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug)]
pub struct DirectChatCreated {}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UsersInvited {
    pub user_ids: Vec<UserId>,
    pub invited_by: UserId,
}
