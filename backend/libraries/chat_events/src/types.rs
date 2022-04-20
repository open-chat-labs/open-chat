use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::cmp::max;
use std::collections::HashSet;
use types::{
    AvatarChanged, ChatMetrics, Cryptocurrency, DirectChatCreated, GroupChatCreated, GroupDescriptionChanged, GroupNameChanged,
    MessageContentInternal, MessageId, MessageIndex, MessagePinned, MessageUnpinned, OwnershipTransferred,
    ParticipantAssumesSuperAdmin, ParticipantDismissedAsSuperAdmin, ParticipantJoined, ParticipantLeft,
    ParticipantRelinquishesSuperAdmin, ParticipantsAdded, ParticipantsRemoved, PermissionsChanged, PollVoteRegistered,
    Reaction, ReplyContext, RoleChanged, TimestampMillis, UserId, UsersBlocked, UsersUnblocked,
};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ChatEventInternal {
    Message(Box<MessageInternal>),
    MessageEdited(Box<UpdatedMessageInternal>),
    MessageDeleted(Box<UpdatedMessageInternal>),
    MessageReactionAdded(Box<UpdatedMessageInternal>),
    MessageReactionRemoved(Box<UpdatedMessageInternal>),
    DirectChatCreated(DirectChatCreated),
    GroupChatCreated(Box<GroupChatCreated>),
    GroupNameChanged(Box<GroupNameChanged>),
    GroupDescriptionChanged(Box<GroupDescriptionChanged>),
    AvatarChanged(Box<AvatarChanged>),
    OwnershipTransferred(Box<OwnershipTransferred>),
    ParticipantsAdded(Box<ParticipantsAdded>),
    ParticipantsRemoved(Box<ParticipantsRemoved>),
    ParticipantJoined(Box<ParticipantJoined>),
    ParticipantLeft(Box<ParticipantLeft>),
    ParticipantAssumesSuperAdmin(Box<ParticipantAssumesSuperAdmin>),
    ParticipantDismissedAsSuperAdmin(Box<ParticipantDismissedAsSuperAdmin>),
    ParticipantRelinquishesSuperAdmin(Box<ParticipantRelinquishesSuperAdmin>),
    RoleChanged(Box<RoleChanged>),
    UsersBlocked(Box<UsersBlocked>),
    UsersUnblocked(Box<UsersUnblocked>),
    MessagePinned(Box<MessagePinned>),
    MessageUnpinned(Box<MessageUnpinned>),
    PollVoteRegistered(Box<PollVoteRegistered>),
    PollVoteDeleted(Box<UpdatedMessageInternal>),
    PollEnded(Box<MessageIndex>),
    PermissionsChanged(Box<PermissionsChanged>),
}

impl ChatEventInternal {
    pub fn is_valid_for_direct_chat(&self) -> bool {
        matches!(
            self,
            ChatEventInternal::Message(_)
                | ChatEventInternal::MessageEdited(_)
                | ChatEventInternal::MessageDeleted(_)
                | ChatEventInternal::MessageReactionAdded(_)
                | ChatEventInternal::MessageReactionRemoved(_)
                | ChatEventInternal::DirectChatCreated(_)
                | ChatEventInternal::PollVoteRegistered(_)
                | ChatEventInternal::PollVoteDeleted(_)
                | ChatEventInternal::PollEnded(_)
        )
    }

    pub fn is_valid_for_group_chat(&self) -> bool {
        matches!(
            self,
            ChatEventInternal::Message(_)
                | ChatEventInternal::MessageEdited(_)
                | ChatEventInternal::MessageDeleted(_)
                | ChatEventInternal::MessageReactionAdded(_)
                | ChatEventInternal::MessageReactionRemoved(_)
                | ChatEventInternal::GroupChatCreated(_)
                | ChatEventInternal::GroupNameChanged(_)
                | ChatEventInternal::GroupDescriptionChanged(_)
                | ChatEventInternal::AvatarChanged(_)
                | ChatEventInternal::OwnershipTransferred(_)
                | ChatEventInternal::ParticipantsAdded(_)
                | ChatEventInternal::ParticipantsRemoved(_)
                | ChatEventInternal::ParticipantJoined(_)
                | ChatEventInternal::ParticipantLeft(_)
                | ChatEventInternal::ParticipantAssumesSuperAdmin(_)
                | ChatEventInternal::ParticipantDismissedAsSuperAdmin(_)
                | ChatEventInternal::ParticipantRelinquishesSuperAdmin(_)
                | ChatEventInternal::RoleChanged(_)
                | ChatEventInternal::UsersBlocked(_)
                | ChatEventInternal::UsersUnblocked(_)
                | ChatEventInternal::MessagePinned(_)
                | ChatEventInternal::MessageUnpinned(_)
                | ChatEventInternal::PollVoteRegistered(_)
                | ChatEventInternal::PollVoteDeleted(_)
                | ChatEventInternal::PollEnded(_)
                | ChatEventInternal::PermissionsChanged(_)
        )
    }

    pub fn add_to_metrics(&self, metrics: &mut ChatMetrics, timestamp: TimestampMillis) {
        match &self {
            ChatEventInternal::Message(m) => {
                match &m.content {
                    MessageContentInternal::Text(_) => metrics.text_messages += 1,
                    MessageContentInternal::Image(_) => metrics.image_messages += 1,
                    MessageContentInternal::Video(_) => metrics.video_messages += 1,
                    MessageContentInternal::Audio(_) => metrics.audio_messages += 1,
                    MessageContentInternal::File(_) => metrics.file_messages += 1,
                    MessageContentInternal::Poll(_) => metrics.polls += 1,
                    MessageContentInternal::Cryptocurrency(c) => match c.transfer.cryptocurrency() {
                        Cryptocurrency::ICP => metrics.icp_messages += 1,
                        Cryptocurrency::Cycles => metrics.cycles_messages += 1,
                    },
                    MessageContentInternal::Deleted(_) => {} // This is accounted for by the MessageDeleted events
                    MessageContentInternal::Giphy(_) => metrics.giphy_messages += 1,
                }

                if m.replies_to.is_some() {
                    metrics.replies += 1;
                }
            }
            ChatEventInternal::MessageEdited(_) => metrics.edits += 1,
            ChatEventInternal::MessageDeleted(_) => metrics.deleted_messages += 1,
            ChatEventInternal::MessageReactionAdded(_) => metrics.reactions += 1,
            ChatEventInternal::MessageReactionRemoved(_) => metrics.reactions = metrics.reactions.saturating_sub(1),
            ChatEventInternal::PollVoteRegistered(v) if !v.existing_vote_removed => metrics.poll_votes += 1,
            ChatEventInternal::PollVoteDeleted(_) => metrics.poll_votes = metrics.poll_votes.saturating_sub(1),
            _ => {}
        }

        metrics.total_events += 1;
        metrics.last_active = max(metrics.last_active, timestamp);
    }

    pub fn triggered_by(&self) -> Option<UserId> {
        match self {
            ChatEventInternal::Message(m) => Some(m.sender),
            ChatEventInternal::GroupChatCreated(g) => Some(g.created_by),
            ChatEventInternal::GroupNameChanged(n) => Some(n.changed_by),
            ChatEventInternal::GroupDescriptionChanged(d) => Some(d.changed_by),
            ChatEventInternal::AvatarChanged(a) => Some(a.changed_by),
            ChatEventInternal::OwnershipTransferred(o) => Some(o.old_owner),
            ChatEventInternal::ParticipantsAdded(p) => Some(p.added_by),
            ChatEventInternal::ParticipantsRemoved(p) => Some(p.removed_by),
            ChatEventInternal::ParticipantJoined(p) => Some(p.user_id),
            ChatEventInternal::ParticipantLeft(p) => Some(p.user_id),
            ChatEventInternal::ParticipantAssumesSuperAdmin(p) => Some(p.user_id),
            ChatEventInternal::ParticipantDismissedAsSuperAdmin(p) => Some(p.user_id),
            ChatEventInternal::ParticipantRelinquishesSuperAdmin(p) => Some(p.user_id),
            ChatEventInternal::RoleChanged(r) => Some(r.changed_by),
            ChatEventInternal::UsersBlocked(u) => Some(u.blocked_by),
            ChatEventInternal::UsersUnblocked(u) => Some(u.unblocked_by),
            ChatEventInternal::MessagePinned(m) => Some(m.pinned_by),
            ChatEventInternal::MessageUnpinned(m) => Some(m.unpinned_by),
            ChatEventInternal::PollVoteRegistered(v) => Some(v.user_id),
            ChatEventInternal::PermissionsChanged(p) => Some(p.changed_by),
            ChatEventInternal::MessageEdited(e)
            | ChatEventInternal::MessageDeleted(e)
            | ChatEventInternal::MessageReactionAdded(e)
            | ChatEventInternal::MessageReactionRemoved(e)
            | ChatEventInternal::PollVoteDeleted(e) => Some(e.updated_by),
            ChatEventInternal::PollEnded(_) | ChatEventInternal::DirectChatCreated(_) => None,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MessageInternal {
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sender: UserId,
    pub content: MessageContentInternal,
    pub replies_to: Option<ReplyContext>,
    pub reactions: Vec<(Reaction, HashSet<UserId>)>,
    pub last_updated: Option<TimestampMillis>,
    pub last_edited: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UpdatedMessageInternal {
    pub updated_by: UserId,
    pub message_id: MessageId,
}
