use crate::incr;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::ops::{Deref, DerefMut};
use types::{
    AvatarChanged, ChatFrozen, ChatMetrics, ChatUnfrozen, Cryptocurrency, DeletedBy, DirectChatCreated,
    EventsTimeToLiveUpdated, GroupChatCreated, GroupDescriptionChanged, GroupGateUpdated, GroupInviteCodeChanged,
    GroupNameChanged, GroupRulesChanged, GroupVisibilityChanged, Message, MessageContent, MessageContentInternal, MessageId,
    MessageIndex, MessagePinned, MessageUnpinned, OwnershipTransferred, ParticipantAssumesSuperAdmin,
    ParticipantDismissedAsSuperAdmin, ParticipantJoined, ParticipantLeft, ParticipantRelinquishesSuperAdmin, ParticipantsAdded,
    ParticipantsRemoved, PermissionsChanged, PollVoteRegistered, Reaction, ReplyContext, RoleChanged, ThreadSummary,
    TimestampMillis, UserId, UsersBlocked, UsersUnblocked,
};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ChatEventInternal {
    Empty,
    Message(Box<MessageInternal>),
    MessageEdited(Box<UpdatedMessageInternal>),
    MessageDeleted(Box<UpdatedMessageInternal>),
    MessageUndeleted(Box<UpdatedMessageInternal>),
    MessageReactionAdded(Box<UpdatedMessageInternal>),
    MessageReactionRemoved(Box<UpdatedMessageInternal>),
    DirectChatCreated(DirectChatCreated),
    GroupChatCreated(Box<GroupChatCreated>),
    GroupNameChanged(Box<GroupNameChanged>),
    GroupDescriptionChanged(Box<GroupDescriptionChanged>),
    GroupRulesChanged(Box<GroupRulesChanged>),
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
    ProposalsUpdated(Box<ProposalsUpdatedInternal>),
    ChatFrozen(Box<ChatFrozen>),
    ChatUnfrozen(Box<ChatUnfrozen>),
    EventsTimeToLiveUpdated(Box<EventsTimeToLiveUpdated>),
    GroupGateUpdated(Box<GroupGateUpdated>),
}

impl ChatEventInternal {
    pub fn is_valid_for_direct_chat(&self) -> bool {
        matches!(
            self,
            ChatEventInternal::Message(_)
                | ChatEventInternal::DirectChatCreated(_)
                | ChatEventInternal::EventsTimeToLiveUpdated(_)
        )
    }

    pub fn is_valid_for_group_chat(&self) -> bool {
        matches!(
            self,
            ChatEventInternal::Message(_)
                | ChatEventInternal::GroupChatCreated(_)
                | ChatEventInternal::GroupNameChanged(_)
                | ChatEventInternal::GroupDescriptionChanged(_)
                | ChatEventInternal::GroupRulesChanged(_)
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
                | ChatEventInternal::PermissionsChanged(_)
                | ChatEventInternal::GroupVisibilityChanged(_)
                | ChatEventInternal::GroupInviteCodeChanged(_)
                | ChatEventInternal::ChatFrozen(_)
                | ChatEventInternal::ChatUnfrozen(_)
                | ChatEventInternal::EventsTimeToLiveUpdated(_)
                | ChatEventInternal::GroupGateUpdated(_)
        )
    }

    pub fn is_valid_for_thread(&self) -> bool {
        matches!(self, ChatEventInternal::Message(_))
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
    pub fn hydrate(&self, my_user_id: Option<UserId>) -> Message {
        Message {
            message_index: self.message_index,
            message_id: self.message_id,
            sender: self.sender,
            content: if let Some(deleted_by) = self.deleted_by.clone() {
                MessageContent::Deleted(deleted_by)
            } else {
                self.content.hydrate(my_user_id)
            },
            replies_to: self.replies_to.clone(),
            reactions: self
                .reactions
                .iter()
                .map(|(r, u)| (r.clone(), u.iter().copied().collect()))
                .collect(),
            edited: self.last_edited.is_some(),
            forwarded: self.forwarded,
            thread_summary: self.thread_summary.clone(),
            last_updated: self.last_updated,
        }
    }

    pub fn add_to_metrics(&self, metrics: &mut ChatMetrics) {
        if self.replies_to.is_some() {
            incr(&mut metrics.replies);
        }

        match &self.content {
            MessageContentInternal::Text(_) => {
                incr(&mut metrics.text_messages);
            }
            MessageContentInternal::Image(_) => {
                incr(&mut metrics.image_messages);
            }
            MessageContentInternal::Video(_) => {
                incr(&mut metrics.video_messages);
            }
            MessageContentInternal::Audio(_) => {
                incr(&mut metrics.audio_messages);
            }
            MessageContentInternal::File(_) => {
                incr(&mut metrics.file_messages);
            }
            MessageContentInternal::Poll(_) => {
                incr(&mut metrics.polls);
            }
            MessageContentInternal::Crypto(c) => match c.transfer.token() {
                Cryptocurrency::InternetComputer => {
                    incr(&mut metrics.icp_messages);
                }
                Cryptocurrency::SNS1 => {
                    incr(&mut metrics.sns1_messages);
                }
                Cryptocurrency::CKBTC => {
                    incr(&mut metrics.ckbtc_messages);
                }
                Cryptocurrency::CHAT => {
                    incr(&mut metrics.chat_messages);
                }
            },
            MessageContentInternal::Deleted(_) => {}
            MessageContentInternal::Giphy(_) => {
                incr(&mut metrics.giphy_messages);
            }
            MessageContentInternal::GovernanceProposal(_) => {
                incr(&mut metrics.proposals);
            }
            MessageContentInternal::Prize(_) => {
                incr(&mut metrics.prize_messages);
            }
            MessageContentInternal::PrizeWinner(_) => {
                incr(&mut metrics.prize_winner_messages);
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
    pub message_index: MessageIndex,
    pub latest_thread_message_index_if_updated: Option<MessageIndex>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ProposalsUpdatedInternal {
    pub proposals: Vec<MessageIndex>,
}
