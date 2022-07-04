use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::cmp::max;
use std::collections::{HashMap, HashSet};
use std::ops::{Deref, DerefMut};
use types::{
    AvatarChanged, ChatMetrics, Cryptocurrency, DeletedBy, DirectChatCreated, GroupChatCreated, GroupDescriptionChanged,
    GroupInviteCodeChanged, GroupNameChanged, GroupVisibilityChanged, MessageContentInternal, MessageId, MessageIndex,
    MessagePinned, MessageUnpinned, OwnershipTransferred, ParticipantAssumesSuperAdmin, ParticipantDismissedAsSuperAdmin,
    ParticipantJoined, ParticipantLeft, ParticipantRelinquishesSuperAdmin, ParticipantsAdded, ParticipantsRemoved,
    PermissionsChanged, PollVoteRegistered, Reaction, ReplyContext, RoleChanged, ThreadSummary, TimestampMillis, UserId,
    UsersBlocked, UsersUnblocked,
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
    GroupVisibilityChanged(Box<GroupVisibilityChanged>),
    GroupInviteCodeChanged(Box<GroupInviteCodeChanged>),
    ThreadUpdated(Box<ThreadUpdatedInternal>),
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
                | ChatEventInternal::ThreadUpdated(_)
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
                | ChatEventInternal::GroupVisibilityChanged(_)
                | ChatEventInternal::GroupInviteCodeChanged(_)
                | ChatEventInternal::ThreadUpdated(_)
        )
    }

    pub fn is_valid_for_thread(&self) -> bool {
        matches!(
            self,
            ChatEventInternal::Message(_)
                | ChatEventInternal::MessageEdited(_)
                | ChatEventInternal::MessageDeleted(_)
                | ChatEventInternal::MessageReactionAdded(_)
                | ChatEventInternal::MessageReactionRemoved(_)
                | ChatEventInternal::PollVoteRegistered(_)
                | ChatEventInternal::PollVoteDeleted(_)
                | ChatEventInternal::PollEnded(_)
        )
    }

    pub fn as_message(&self) -> Option<&MessageInternal> {
        if let ChatEventInternal::Message(m) = self {
            Some(m.deref())
        } else {
            None
        }
    }

    pub fn as_message_mut(&mut self) -> Option<&mut MessageInternal> {
        if let ChatEventInternal::Message(m) = self {
            Some(m.deref_mut())
        } else {
            None
        }
    }

    pub fn add_to_metrics(
        &self,
        metrics: &mut ChatMetrics,
        per_user_metrics: &mut HashMap<UserId, ChatMetrics>,
        timestamp: TimestampMillis,
    ) {
        match &self {
            ChatEventInternal::Message(m) => m.add_to_metrics(metrics, per_user_metrics),
            ChatEventInternal::MessageEdited(m) => {
                incr(&mut metrics.edits);
                incr(&mut per_user_metrics.entry(m.updated_by).or_default().edits);
            }
            ChatEventInternal::MessageDeleted(m) => {
                incr(&mut metrics.deleted_messages);
                incr(&mut per_user_metrics.entry(m.updated_by).or_default().deleted_messages);
            }
            ChatEventInternal::MessageReactionAdded(m) => {
                incr(&mut metrics.reactions);
                incr(&mut per_user_metrics.entry(m.updated_by).or_default().reactions);
            }
            ChatEventInternal::MessageReactionRemoved(m) => {
                decr(&mut metrics.reactions);
                decr(&mut per_user_metrics.entry(m.updated_by).or_default().reactions);
            }
            ChatEventInternal::PollVoteRegistered(v) if !v.existing_vote_removed => {
                incr(&mut metrics.poll_votes);
                incr(&mut per_user_metrics.entry(v.user_id).or_default().poll_votes);
            }
            ChatEventInternal::PollVoteDeleted(v) => {
                decr(&mut metrics.poll_votes);
                decr(&mut per_user_metrics.entry(v.updated_by).or_default().poll_votes);
            }
            _ => {}
        }

        metrics.last_active = max(metrics.last_active, timestamp);

        if let Some(user_id) = self.triggered_by() {
            let user_metrics = per_user_metrics.entry(user_id).or_default();
            user_metrics.last_active = max(user_metrics.last_active, timestamp);
        }
    }

    fn triggered_by(&self) -> Option<UserId> {
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
            ChatEventInternal::GroupVisibilityChanged(p) => Some(p.changed_by),
            ChatEventInternal::GroupInviteCodeChanged(p) => Some(p.changed_by),
            ChatEventInternal::ThreadUpdated(e) => Some(e.updated_by),
            ChatEventInternal::MessageEdited(e)
            | ChatEventInternal::MessageDeleted(e)
            | ChatEventInternal::MessageReactionAdded(e)
            | ChatEventInternal::MessageReactionRemoved(e)
            | ChatEventInternal::PollVoteDeleted(e) => Some(e.updated_by),
            ChatEventInternal::DirectChatCreated(_) | ChatEventInternal::PollEnded(_) => None,
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
    pub deleted_by: Option<DeletedBy>,
    pub thread_summary: Option<ThreadSummary>,
    pub forwarded: bool,
}

impl MessageInternal {
    pub fn add_to_metrics(&self, metrics: &mut ChatMetrics, per_user_metrics: &mut HashMap<UserId, ChatMetrics>) {
        self.adjust_metrics(metrics, per_user_metrics, incr);
    }

    pub fn remove_from_metrics(&self, metrics: &mut ChatMetrics, per_user_metrics: &mut HashMap<UserId, ChatMetrics>) {
        self.adjust_metrics(metrics, per_user_metrics, decr);
    }

    fn adjust_metrics(
        &self,
        metrics: &mut ChatMetrics,
        per_user_metrics: &mut HashMap<UserId, ChatMetrics>,
        adjust: fn(&mut u64),
    ) {
        let sender_metrics = per_user_metrics.entry(self.sender).or_default();

        if self.deleted_by.is_some() {
            adjust(&mut metrics.deleted_messages);
            adjust(&mut sender_metrics.deleted_messages);
        } else {
            if self.replies_to.is_some() {
                adjust(&mut metrics.replies);
                adjust(&mut sender_metrics.replies);
            }

            match &self.content {
                MessageContentInternal::Text(_) => {
                    adjust(&mut metrics.text_messages);
                    adjust(&mut sender_metrics.text_messages);
                }
                MessageContentInternal::Image(_) => {
                    adjust(&mut metrics.image_messages);
                    adjust(&mut sender_metrics.image_messages);
                }
                MessageContentInternal::Video(_) => {
                    adjust(&mut metrics.video_messages);
                    adjust(&mut sender_metrics.video_messages);
                }
                MessageContentInternal::Audio(_) => {
                    adjust(&mut metrics.audio_messages);
                    adjust(&mut sender_metrics.audio_messages);
                }
                MessageContentInternal::File(_) => {
                    adjust(&mut metrics.file_messages);
                    adjust(&mut sender_metrics.file_messages);
                }
                MessageContentInternal::Poll(p) => {
                    adjust(&mut metrics.polls);
                    adjust(&mut sender_metrics.polls);

                    for user_id in p.votes.iter().flat_map(|(_, u)| u.iter()) {
                        adjust(&mut metrics.poll_votes);
                        if let Some(user_metrics) = per_user_metrics.get_mut(user_id) {
                            adjust(&mut user_metrics.poll_votes);
                        }
                    }
                }
                MessageContentInternal::Cryptocurrency(c) => match c.transfer.token() {
                    Cryptocurrency::InternetComputer => {
                        adjust(&mut metrics.icp_messages);
                        adjust(&mut sender_metrics.icp_messages);
                    }
                },
                MessageContentInternal::Deleted(_) => {}
                MessageContentInternal::Giphy(_) => {
                    adjust(&mut metrics.giphy_messages);
                    adjust(&mut sender_metrics.giphy_messages);
                }
                MessageContentInternal::GovernanceProposal(_) => {
                    adjust(&mut metrics.proposals);
                    adjust(&mut sender_metrics.proposals);
                }
            }

            for user_id in self.reactions.iter().flat_map(|(_, u)| u.iter()) {
                adjust(&mut metrics.reactions);
                if let Some(user_metrics) = per_user_metrics.get_mut(user_id) {
                    adjust(&mut user_metrics.reactions);
                }
            }
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UpdatedMessageInternal {
    pub updated_by: UserId,
    pub message_id: MessageId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ThreadUpdatedInternal {
    pub updated_by: UserId,
    pub message_index: MessageIndex,
}

fn incr(counter: &mut u64) {
    *counter += 1;
}

fn decr(counter: &mut u64) {
    *counter = counter.saturating_sub(1);
}
