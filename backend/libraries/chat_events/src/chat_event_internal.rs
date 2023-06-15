use crate::incr;
use search::Document;
use serde::{Deserialize, Serialize};
use std::cmp::max;
use std::collections::{HashMap, HashSet};
use std::ops::{Deref, DerefMut};
use types::{
    is_default, is_empty_slice, AudioContent, AvatarChanged, BlobReference, CanisterId, ChatId, ChatMetrics,
    CompletedCryptoTransaction, CryptoContent, CryptoTransaction, Cryptocurrency, CustomContent, DeletedBy, DirectChatCreated,
    EventIndex, EventsTimeToLiveUpdated, FileContent, GiphyContent, GroupCreated, GroupDescriptionChanged, GroupFrozen,
    GroupGateUpdated, GroupInviteCodeChanged, GroupNameChanged, GroupReplyContext, GroupRulesChanged, GroupUnfrozen,
    GroupVisibilityChanged, ImageContent, MemberJoined, MemberLeft, MembersAdded, MembersRemoved, Message, MessageContent,
    MessageContentInitial, MessageId, MessageIndex, MessagePinned, MessageReminderContent, MessageReminderCreatedContent,
    MessageUnpinned, OwnershipTransferred, ParticipantAssumesSuperAdmin, ParticipantDismissedAsSuperAdmin,
    ParticipantRelinquishesSuperAdmin, PermissionsChanged, PollContentInternal, PollVoteRegistered, PrizeContent,
    PrizeContentInternal, PrizeWinnerContent, Proposal, ProposalContent, Reaction, ReplyContext, ReportedMessage,
    ReportedMessageInternal, RoleChanged, TextContent, ThreadSummary, TimestampMillis, UserId, UsersBlocked, UsersInvited,
    UsersUnblocked, VideoContent,
};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(from = "ChatEventInternalPrevious")]
pub enum ChatEventInternal {
    #[serde(rename = "m", alias = "Message")]
    Message(Box<MessageInternal>),
    #[serde(rename = "dcc", alias = "DirectChatCreated")]
    DirectChatCreated(DirectChatCreated),
    #[serde(rename = "gcc", alias = "GroupChatCreated")]
    GroupChatCreated(Box<GroupCreated>),
    #[serde(rename = "nc", alias = "GroupNameChanged")]
    GroupNameChanged(Box<GroupNameChanged>),
    #[serde(rename = "dc", alias = "GroupDescriptionChanged")]
    GroupDescriptionChanged(Box<GroupDescriptionChanged>),
    #[serde(rename = "grc", alias = "GroupRulesChanged")]
    GroupRulesChanged(Box<GroupRulesChanged>),
    #[serde(rename = "ac", alias = "AvatarChanged")]
    AvatarChanged(Box<AvatarChanged>),
    #[serde(rename = "ot", alias = "OwnershipTransferred")]
    OwnershipTransferred(Box<OwnershipTransferred>),
    #[serde(rename = "ma", alias = "ParticipantsAdded")]
    ParticipantsAdded(Box<MembersAdded>),
    #[serde(rename = "mr", alias = "ParticipantsRemoved")]
    ParticipantsRemoved(Box<MembersRemoved>),
    #[serde(rename = "mj", alias = "ParticipantJoined")]
    ParticipantJoined(Box<MemberJoined>),
    #[serde(rename = "ml", alias = "ParticipantLeft")]
    ParticipantLeft(Box<MemberLeft>),
    #[serde(rename = "asa", alias = "ParticipantAssumesSuperAdmin")]
    ParticipantAssumesSuperAdmin(Box<ParticipantAssumesSuperAdmin>),
    #[serde(rename = "dsa", alias = "ParticipantDismissedAsSuperAdmin")]
    ParticipantDismissedAsSuperAdmin(Box<ParticipantDismissedAsSuperAdmin>),
    #[serde(rename = "rsa", alias = "ParticipantRelinquishesSuperAdmin")]
    ParticipantRelinquishesSuperAdmin(Box<ParticipantRelinquishesSuperAdmin>),
    #[serde(rename = "rc", alias = "RoleChanged")]
    RoleChanged(Box<RoleChanged>),
    #[serde(rename = "ub", alias = "UsersBlocked")]
    UsersBlocked(Box<UsersBlocked>),
    #[serde(rename = "uub", alias = "UsersUnblocked")]
    UsersUnblocked(Box<UsersUnblocked>),
    #[serde(rename = "mp", alias = "MessagePinned")]
    MessagePinned(Box<MessagePinned>),
    #[serde(rename = "mup", alias = "MessageUnpinned")]
    MessageUnpinned(Box<MessageUnpinned>),
    #[serde(rename = "pc", alias = "PermissionsChanged")]
    PermissionsChanged(Box<PermissionsChanged>),
    #[serde(rename = "vc", alias = "GroupVisibilityChanged")]
    GroupVisibilityChanged(Box<GroupVisibilityChanged>),
    #[serde(rename = "icc", alias = "GroupInviteCodeChanged")]
    GroupInviteCodeChanged(Box<GroupInviteCodeChanged>),
    #[serde(rename = "fz", alias = "ChatFrozen")]
    ChatFrozen(Box<GroupFrozen>),
    #[serde(rename = "ufz", alias = "ChatUnfrozen")]
    ChatUnfrozen(Box<GroupUnfrozen>),
    #[serde(rename = "ttl", alias = "EventsTimeToLiveUpdated")]
    EventsTimeToLiveUpdated(Box<EventsTimeToLiveUpdated>),
    #[serde(rename = "gu", alias = "GroupGateUpdated")]
    GroupGateUpdated(Box<GroupGateUpdated>),
    #[serde(rename = "ui", alias = "UsersInvited")]
    UsersInvited(Box<UsersInvited>),
    #[serde(rename = "e", alias = "Empty")]
    Empty,
}

#[derive(Serialize, Deserialize)]
pub enum ChatEventInternalPrevious {
    Empty,
    #[serde(rename = "m", alias = "Message")]
    Message(Box<MessageInternal>),
    MessageEdited(Box<UpdatedMessageInternal>),
    MessageDeleted(Box<UpdatedMessageInternal>),
    MessageUndeleted(Box<UpdatedMessageInternal>),
    MessageReactionAdded(Box<UpdatedMessageInternal>),
    MessageReactionRemoved(Box<UpdatedMessageInternal>),
    DirectChatCreated(DirectChatCreated),
    GroupChatCreated(Box<GroupCreated>),
    GroupNameChanged(Box<GroupNameChanged>),
    GroupDescriptionChanged(Box<GroupDescriptionChanged>),
    GroupRulesChanged(Box<GroupRulesChanged>),
    AvatarChanged(Box<AvatarChanged>),
    OwnershipTransferred(Box<OwnershipTransferred>),
    ParticipantsAdded(Box<MembersAdded>),
    ParticipantsRemoved(Box<MembersRemoved>),
    ParticipantJoined(Box<MemberJoined>),
    ParticipantLeft(Box<MemberLeft>),
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
    ChatFrozen(Box<GroupFrozen>),
    ChatUnfrozen(Box<GroupUnfrozen>),
    EventsTimeToLiveUpdated(Box<EventsTimeToLiveUpdated>),
    GroupGateUpdated(Box<GroupGateUpdated>),
    UsersInvited(Box<UsersInvited>),
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
                | ChatEventInternal::UsersInvited(_)
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

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MessageInternal {
    #[serde(rename = "x", alias = "message_index")]
    pub message_index: MessageIndex,
    #[serde(rename = "i", alias = "message_id")]
    pub message_id: MessageId,
    #[serde(rename = "s", alias = "sender")]
    pub sender: UserId,
    #[serde(rename = "c", alias = "content")]
    pub content: MessageContentInternal,
    #[serde(rename = "p", alias = "replies_to", default, skip_serializing_if = "Option::is_none")]
    pub replies_to: Option<ReplyContextInternal>,
    #[serde(rename = "r", alias = "reactions", default, skip_serializing_if = "is_empty_slice")]
    pub reactions: Vec<(Reaction, HashSet<UserId>)>,
    #[serde(rename = "u", alias = "last_updated", default, skip_serializing_if = "Option::is_none")]
    pub last_updated: Option<TimestampMillis>,
    #[serde(rename = "e", alias = "last_edited", default, skip_serializing_if = "Option::is_none")]
    pub last_edited: Option<TimestampMillis>,
    #[serde(rename = "d", alias = "deleted_by", default, skip_serializing_if = "Option::is_none")]
    pub deleted_by: Option<DeletedByInternal>,
    #[serde(rename = "t", alias = "thread_summary", default, skip_serializing_if = "Option::is_none")]
    pub thread_summary: Option<ThreadSummaryInternal>,
    #[serde(rename = "f", alias = "forwarded", default, skip_serializing_if = "is_default")]
    pub forwarded: bool,
}

impl MessageInternal {
    pub fn hydrate(&self, my_user_id: Option<UserId>) -> Message {
        Message {
            message_index: self.message_index,
            message_id: self.message_id,
            sender: self.sender,
            content: if let Some(deleted_by) = self.deleted_by.clone() {
                MessageContent::Deleted(deleted_by.hydrate())
            } else {
                self.content.hydrate(my_user_id)
            },
            replies_to: self.replies_to.as_ref().map(|r| r.hydrate()),
            reactions: self
                .reactions
                .iter()
                .map(|(r, u)| (r.clone(), u.iter().copied().collect()))
                .collect(),
            edited: self.last_edited.is_some(),
            forwarded: self.forwarded,
            thread_summary: self.thread_summary.as_ref().map(|t| t.hydrate()),
            last_updated: self.last_updated,
        }
    }

    pub fn add_to_metrics(&self, metrics: &mut ChatMetricsInternal) {
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
            MessageContentInternal::MessageReminderCreated(_) => {}
            MessageContentInternal::MessageReminder(_) => {
                incr(&mut metrics.message_reminders);
            }
            MessageContentInternal::ReportedMessage(_) => {}
            MessageContentInternal::Custom(_) => {
                incr(&mut metrics.custom_type_messages);
            }
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum MessageContentInternal {
    #[serde(rename = "t", alias = "Text")]
    Text(TextContent),
    #[serde(rename = "i", alias = "Image")]
    Image(ImageContent),
    #[serde(rename = "v", alias = "Video")]
    Video(VideoContent),
    #[serde(rename = "a", alias = "Audio")]
    Audio(AudioContent),
    #[serde(rename = "f", alias = "File")]
    File(FileContent),
    #[serde(rename = "p", alias = "Poll")]
    Poll(PollContentInternal),
    #[serde(rename = "c", alias = "Crypto")]
    Crypto(CryptoContent),
    #[serde(rename = "d", alias = "Deleted")]
    Deleted(DeletedByInternal),
    #[serde(rename = "g", alias = "Giphy")]
    Giphy(GiphyContent),
    #[serde(rename = "gp", alias = "GovernanceProposal")]
    GovernanceProposal(ProposalContentInternal),
    #[serde(rename = "pr", alias = "Prize")]
    Prize(PrizeContentInternal),
    #[serde(rename = "pw", alias = "PrizeWinner")]
    PrizeWinner(PrizeWinnerContent),
    #[serde(rename = "mrc", alias = "MessageReminderCreated")]
    MessageReminderCreated(MessageReminderCreatedContent),
    #[serde(rename = "mr", alias = "MessageReminder")]
    MessageReminder(MessageReminderContent),
    #[serde(rename = "rm", alias = "ReportedMessage")]
    ReportedMessage(ReportedMessageInternal),
    #[serde(rename = "cu", alias = "Custom")]
    Custom(CustomContent),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UpdatedMessageInternal {
    pub updated_by: UserId,
    pub message_id: MessageId,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ThreadUpdatedInternal {
    pub message_index: MessageIndex,
    pub latest_thread_message_index_if_updated: Option<MessageIndex>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProposalsUpdatedInternal {
    pub proposals: Vec<MessageIndex>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProposalContentInternal {
    pub governance_canister_id: CanisterId,
    pub proposal: Proposal,
    pub votes: HashMap<UserId, bool>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DeletedByInternal {
    #[serde(rename = "d", alias = "deleted_by")]
    pub deleted_by: UserId,
    #[serde(rename = "t", alias = "timestamp")]
    pub timestamp: TimestampMillis,
}

impl DeletedByInternal {
    pub fn hydrate(&self) -> DeletedBy {
        DeletedBy {
            deleted_by: self.deleted_by,
            timestamp: self.timestamp,
        }
    }
}

impl From<DeletedBy> for DeletedByInternal {
    fn from(value: DeletedBy) -> Self {
        DeletedByInternal {
            deleted_by: value.deleted_by,
            timestamp: value.timestamp,
        }
    }
}

impl MessageContentInternal {
    pub fn hydrate(&self, my_user_id: Option<UserId>) -> MessageContent {
        match self {
            MessageContentInternal::Text(t) => MessageContent::Text(t.clone()),
            MessageContentInternal::Image(i) => MessageContent::Image(i.clone()),
            MessageContentInternal::Video(v) => MessageContent::Video(v.clone()),
            MessageContentInternal::Audio(a) => MessageContent::Audio(a.clone()),
            MessageContentInternal::File(f) => MessageContent::File(f.clone()),
            MessageContentInternal::Poll(p) => MessageContent::Poll(p.hydrate(my_user_id)),
            MessageContentInternal::Crypto(c) => MessageContent::Crypto(c.clone()),
            MessageContentInternal::Deleted(d) => MessageContent::Deleted(d.hydrate()),
            MessageContentInternal::Giphy(g) => MessageContent::Giphy(g.clone()),
            MessageContentInternal::PrizeWinner(c) => MessageContent::PrizeWinner(c.clone()),
            MessageContentInternal::GovernanceProposal(p) => MessageContent::GovernanceProposal(ProposalContent {
                governance_canister_id: p.governance_canister_id,
                proposal: p.proposal.clone(),
                my_vote: my_user_id.and_then(|u| p.votes.get(&u)).copied(),
            }),
            MessageContentInternal::Prize(p) => MessageContent::Prize(PrizeContent {
                prizes_remaining: p.prizes_remaining.len() as u32,
                winners: p.winners.iter().copied().collect(),
                token: p.transaction.token(),
                end_date: p.end_date,
                caption: p.caption.clone(),
                prizes_pending: p.reservations.len() as u32,
            }),
            MessageContentInternal::MessageReminderCreated(r) => MessageContent::MessageReminderCreated(r.clone()),
            MessageContentInternal::MessageReminder(r) => MessageContent::MessageReminder(r.clone()),
            MessageContentInternal::ReportedMessage(r) => MessageContent::ReportedMessage(ReportedMessage {
                reports: r.reports.iter().take(10).cloned().collect(),
                count: r.reports.len() as u32,
            }),
            MessageContentInternal::Custom(c) => MessageContent::Custom(c.clone()),
        }
    }

    pub fn text(&self) -> Option<&str> {
        match self {
            MessageContentInternal::Text(c) => Some(&c.text),
            MessageContentInternal::Image(c) => c.caption.as_deref(),
            MessageContentInternal::Video(c) => c.caption.as_deref(),
            MessageContentInternal::Audio(c) => c.caption.as_deref(),
            MessageContentInternal::File(c) => c.caption.as_deref(),
            MessageContentInternal::Poll(c) => c.config.text.as_deref(),
            MessageContentInternal::Crypto(c) => c.caption.as_deref(),
            MessageContentInternal::Giphy(c) => c.caption.as_deref(),
            MessageContentInternal::GovernanceProposal(c) => Some(c.proposal.title()),
            MessageContentInternal::Prize(c) => c.caption.as_deref(),
            MessageContentInternal::MessageReminderCreated(r) => r.notes.as_deref(),
            MessageContentInternal::MessageReminder(r) => r.notes.as_deref(),
            MessageContentInternal::PrizeWinner(_)
            | MessageContentInternal::Deleted(_)
            | MessageContentInternal::ReportedMessage(_)
            | MessageContentInternal::Custom(_) => None,
        }
    }

    pub fn blob_references(&self) -> Vec<BlobReference> {
        let mut references = Vec::new();

        match self {
            MessageContentInternal::Image(i) => {
                if let Some(br) = i.blob_reference.clone() {
                    references.push(br);
                }
            }
            MessageContentInternal::Video(v) => {
                if let Some(br) = v.video_blob_reference.clone() {
                    references.push(br);
                }
                if let Some(br) = v.image_blob_reference.clone() {
                    references.push(br);
                }
            }
            MessageContentInternal::Audio(a) => {
                if let Some(br) = a.blob_reference.clone() {
                    references.push(br)
                }
            }
            MessageContentInternal::File(f) => {
                if let Some(br) = f.blob_reference.clone() {
                    references.push(br);
                }
            }
            MessageContentInternal::Text(_)
            | MessageContentInternal::Poll(_)
            | MessageContentInternal::Crypto(_)
            | MessageContentInternal::Deleted(_)
            | MessageContentInternal::Giphy(_)
            | MessageContentInternal::GovernanceProposal(_)
            | MessageContentInternal::Prize(_)
            | MessageContentInternal::PrizeWinner(_)
            | MessageContentInternal::MessageReminderCreated(_)
            | MessageContentInternal::MessageReminder(_)
            | MessageContentInternal::ReportedMessage(_)
            | MessageContentInternal::Custom(_) => {}
        }

        references
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct ThreadSummaryInternal {
    #[serde(rename = "i", alias = "participant_ids")]
    pub participant_ids: Vec<UserId>,
    #[serde(rename = "r", alias = "reply_count")]
    pub reply_count: u32,
    #[serde(rename = "e", alias = "latest_event_index")]
    pub latest_event_index: EventIndex,
    #[serde(rename = "t", alias = "latest_event_timestamp")]
    pub latest_event_timestamp: TimestampMillis,
}

impl ThreadSummaryInternal {
    pub fn hydrate(&self) -> ThreadSummary {
        ThreadSummary {
            participant_ids: self.participant_ids.clone(),
            reply_count: self.reply_count,
            latest_event_index: self.latest_event_index,
            latest_event_timestamp: self.latest_event_timestamp,
        }
    }
}

impl From<MessageContentInitial> for MessageContentInternal {
    fn from(value: MessageContentInitial) -> Self {
        match value {
            MessageContentInitial::Text(t) => MessageContentInternal::Text(t),
            MessageContentInitial::Image(i) => MessageContentInternal::Image(i),
            MessageContentInitial::Video(v) => MessageContentInternal::Video(v),
            MessageContentInitial::Audio(a) => MessageContentInternal::Audio(a),
            MessageContentInitial::File(f) => MessageContentInternal::File(f),
            MessageContentInitial::Poll(p) => MessageContentInternal::Poll(PollContentInternal {
                config: p.config,
                votes: HashMap::new(),
                ended: false,
            }),
            MessageContentInitial::Crypto(c) => MessageContentInternal::Crypto(c),
            MessageContentInitial::Deleted(d) => MessageContentInternal::Deleted(d.into()),
            MessageContentInitial::Giphy(g) => MessageContentInternal::Giphy(g),
            MessageContentInitial::GovernanceProposal(p) => {
                MessageContentInternal::GovernanceProposal(ProposalContentInternal {
                    governance_canister_id: p.governance_canister_id,
                    proposal: p.proposal,
                    votes: HashMap::new(),
                })
            }
            MessageContentInitial::Prize(p) => MessageContentInternal::Prize(PrizeContentInternal {
                prizes_remaining: p.prizes,
                winners: HashSet::new(),
                end_date: p.end_date,
                caption: p.caption,
                reservations: HashSet::new(),
                transaction: p.transfer,
            }),
            MessageContentInitial::MessageReminderCreated(r) => MessageContentInternal::MessageReminderCreated(r),
            MessageContentInitial::MessageReminder(r) => MessageContentInternal::MessageReminder(r),
            MessageContentInitial::Custom(c) => MessageContentInternal::Custom(c),
        }
    }
}

impl From<&MessageContentInternal> for Document {
    fn from(message_content: &MessageContentInternal) -> Self {
        let mut document = Document::default();

        fn try_add_caption(document: &mut Document, caption_option: Option<&String>) {
            if let Some(caption) = caption_option {
                document.add_field(caption.to_owned(), 1.0, false);
            }
        }

        fn try_add_caption_and_mime_type(document: &mut Document, caption_option: Option<&String>, mime_type: &str) {
            document.add_field(mime_type.to_owned(), 1.0, false);
            try_add_caption(document, caption_option);
        }

        match message_content {
            MessageContentInternal::Text(c) => {
                document.add_field(c.text.clone(), 1.0, false);
            }
            MessageContentInternal::Crypto(c) => {
                let token = c.transfer.token();
                document.add_field(token.token_symbol().to_string(), 1.0, false);

                if let CryptoTransaction::Completed(c) = &c.transfer {
                    let amount_string = match c {
                        CompletedCryptoTransaction::NNS(t) => {
                            format!("{}", t.amount)
                        }
                        CompletedCryptoTransaction::SNS(t) => {
                            format!("{}", t.amount)
                        }
                    };
                    document.add_field(amount_string, 1.0, false);
                }

                try_add_caption(&mut document, c.caption.as_ref())
            }
            MessageContentInternal::Image(c) => try_add_caption_and_mime_type(&mut document, c.caption.as_ref(), &c.mime_type),
            MessageContentInternal::Video(c) => try_add_caption_and_mime_type(&mut document, c.caption.as_ref(), &c.mime_type),
            MessageContentInternal::Audio(c) => try_add_caption_and_mime_type(&mut document, c.caption.as_ref(), &c.mime_type),
            MessageContentInternal::File(c) => try_add_caption_and_mime_type(&mut document, c.caption.as_ref(), &c.mime_type),
            MessageContentInternal::Giphy(c) => try_add_caption(&mut document, c.caption.as_ref()),
            MessageContentInternal::Poll(p) => {
                document.add_field("poll".to_string(), 1.0, false);
                if let Some(text) = p.config.text.clone() {
                    document.add_field(text, 1.0, false);
                }
            }
            MessageContentInternal::GovernanceProposal(p) => {
                document.add_field(p.proposal.title().to_string(), 1.0, false);
                document.add_field(p.proposal.summary().to_string(), 1.0, false);
            }
            MessageContentInternal::Prize(c) => {
                document.add_field(c.transaction.token().token_symbol().to_string(), 1.0, false);
                try_add_caption(&mut document, c.caption.as_ref())
            }
            MessageContentInternal::PrizeWinner(c) => {
                document.add_field(c.transaction.token().token_symbol().to_string(), 1.0, false);
            }
            MessageContentInternal::MessageReminderCreated(r) => try_add_caption(&mut document, r.notes.as_ref()),
            MessageContentInternal::MessageReminder(r) => try_add_caption(&mut document, r.notes.as_ref()),
            MessageContentInternal::Custom(c) => {
                document.add_field(c.kind.clone(), 1.0, false);
            }
            MessageContentInternal::ReportedMessage(_) | MessageContentInternal::Deleted(_) => {}
        }

        document
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ReplyContextInternal {
    #[serde(rename = "l", alias = "event_list_if_other")]
    pub event_list_if_other: Option<(ChatId, Option<MessageIndex>)>,
    #[serde(rename = "e", alias = "event_index")]
    pub event_index: EventIndex,
}

impl ReplyContextInternal {
    pub fn hydrate(&self) -> ReplyContext {
        ReplyContext {
            chat_id_if_other: self.event_list_if_other.as_ref().map(|(e, _)| *e),
            event_list_if_other: self.event_list_if_other,
            event_index: self.event_index,
        }
    }
}

impl From<&GroupReplyContext> for ReplyContextInternal {
    fn from(value: &GroupReplyContext) -> Self {
        ReplyContextInternal {
            event_list_if_other: None,
            event_index: value.event_index,
        }
    }
}

impl From<&ReplyContext> for ReplyContextInternal {
    fn from(value: &ReplyContext) -> Self {
        ReplyContextInternal {
            event_list_if_other: value.event_list_if_other,
            event_index: value.event_index,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct ChatMetricsInternal {
    #[serde(rename = "t", alias = "text_messages", default, skip_serializing_if = "is_default")]
    pub text_messages: u64,
    #[serde(rename = "i", alias = "image_messages", default, skip_serializing_if = "is_default")]
    pub image_messages: u64,
    #[serde(rename = "v", alias = "video_messages", default, skip_serializing_if = "is_default")]
    pub video_messages: u64,
    #[serde(rename = "a", alias = "audio_messages", default, skip_serializing_if = "is_default")]
    pub audio_messages: u64,
    #[serde(rename = "f", alias = "file_messages", default, skip_serializing_if = "is_default")]
    pub file_messages: u64,
    #[serde(rename = "p", alias = "polls", default, skip_serializing_if = "is_default")]
    pub polls: u64,
    #[serde(rename = "pv", alias = "poll_votes", default, skip_serializing_if = "is_default")]
    pub poll_votes: u64,
    #[serde(rename = "icp", alias = "icp_messages", default, skip_serializing_if = "is_default")]
    pub icp_messages: u64,
    #[serde(rename = "sns1", alias = "sns1_messages", default, skip_serializing_if = "is_default")]
    pub sns1_messages: u64,
    #[serde(rename = "ckbtc", alias = "sns1_messages", default, skip_serializing_if = "is_default")]
    pub ckbtc_messages: u64,
    #[serde(rename = "chat", alias = "sns1_messages", default, skip_serializing_if = "is_default")]
    pub chat_messages: u64,
    #[serde(rename = "d", alias = "deleted_messages", default, skip_serializing_if = "is_default")]
    pub deleted_messages: u64,
    #[serde(rename = "g", alias = "giphy_messages", default, skip_serializing_if = "is_default")]
    pub giphy_messages: u64,
    #[serde(rename = "pz", alias = "prize_messages", default, skip_serializing_if = "is_default")]
    pub prize_messages: u64,
    #[serde(
        rename = "pzw",
        alias = "prize_winner_messages",
        default,
        skip_serializing_if = "is_default"
    )]
    pub prize_winner_messages: u64,
    #[serde(rename = "rp", alias = "replies", default, skip_serializing_if = "is_default")]
    pub replies: u64,
    #[serde(rename = "e", alias = "edits", default, skip_serializing_if = "is_default")]
    pub edits: u64,
    #[serde(rename = "rt", alias = "reactions", default, skip_serializing_if = "is_default")]
    pub reactions: u64,
    #[serde(rename = "pr", alias = "proposals", default, skip_serializing_if = "is_default")]
    pub proposals: u64,
    #[serde(rename = "rpt", alias = "reported_messages", default, skip_serializing_if = "is_default")]
    pub reported_messages: u64,
    #[serde(rename = "mr", alias = "message_reminders", default, skip_serializing_if = "is_default")]
    pub message_reminders: u64,
    #[serde(rename = "cu", alias = "custom_type_messages", default, skip_serializing_if = "is_default")]
    pub custom_type_messages: u64,
    #[serde(rename = "la", alias = "last_active")]
    pub last_active: TimestampMillis,
}

impl ChatMetricsInternal {
    pub fn merge(&mut self, other: &ChatMetricsInternal) {
        self.text_messages += other.text_messages;
        self.image_messages += other.image_messages;
        self.video_messages += other.video_messages;
        self.audio_messages += other.audio_messages;
        self.file_messages += other.file_messages;
        self.polls += other.polls;
        self.poll_votes += other.poll_votes;
        self.icp_messages += other.icp_messages;
        self.sns1_messages += other.sns1_messages;
        self.ckbtc_messages += other.ckbtc_messages;
        self.chat_messages += other.chat_messages;
        self.deleted_messages += other.deleted_messages;
        self.giphy_messages += other.giphy_messages;
        self.prize_messages += other.prize_messages;
        self.prize_winner_messages += other.prize_winner_messages;
        self.replies += other.replies;
        self.edits += other.edits;
        self.reactions += other.reactions;
        self.proposals += other.proposals;
        self.last_active = max(self.last_active, other.last_active);
    }

    pub fn hydrate(&self) -> ChatMetrics {
        ChatMetrics {
            text_messages: self.text_messages,
            image_messages: self.image_messages,
            video_messages: self.video_messages,
            audio_messages: self.audio_messages,
            file_messages: self.file_messages,
            polls: self.polls,
            poll_votes: self.poll_votes,
            icp_messages: self.icp_messages,
            sns1_messages: self.sns1_messages,
            ckbtc_messages: self.ckbtc_messages,
            chat_messages: self.chat_messages,
            deleted_messages: self.deleted_messages,
            giphy_messages: self.giphy_messages,
            prize_messages: self.prize_messages,
            prize_winner_messages: self.prize_winner_messages,
            replies: self.replies,
            edits: self.edits,
            reactions: self.reactions,
            proposals: self.proposals,
            reported_messages: self.reported_messages,
            message_reminders: self.message_reminders,
            custom_type_messages: self.custom_type_messages,
            last_active: self.last_active,
        }
    }
}

impl From<ChatEventInternalPrevious> for ChatEventInternal {
    fn from(value: ChatEventInternalPrevious) -> Self {
        match value {
            ChatEventInternalPrevious::Message(x) => ChatEventInternal::Message(x),
            ChatEventInternalPrevious::DirectChatCreated(x) => ChatEventInternal::DirectChatCreated(x),
            ChatEventInternalPrevious::GroupChatCreated(x) => ChatEventInternal::GroupChatCreated(x),
            ChatEventInternalPrevious::GroupNameChanged(x) => ChatEventInternal::GroupNameChanged(x),
            ChatEventInternalPrevious::GroupDescriptionChanged(x) => ChatEventInternal::GroupDescriptionChanged(x),
            ChatEventInternalPrevious::GroupRulesChanged(x) => ChatEventInternal::GroupRulesChanged(x),
            ChatEventInternalPrevious::AvatarChanged(x) => ChatEventInternal::AvatarChanged(x),
            ChatEventInternalPrevious::OwnershipTransferred(x) => ChatEventInternal::OwnershipTransferred(x),
            ChatEventInternalPrevious::ParticipantsAdded(x) => ChatEventInternal::ParticipantsAdded(x),
            ChatEventInternalPrevious::ParticipantsRemoved(x) => ChatEventInternal::ParticipantsRemoved(x),
            ChatEventInternalPrevious::ParticipantJoined(x) => ChatEventInternal::ParticipantJoined(x),
            ChatEventInternalPrevious::ParticipantLeft(x) => ChatEventInternal::ParticipantLeft(x),
            ChatEventInternalPrevious::ParticipantAssumesSuperAdmin(x) => ChatEventInternal::ParticipantAssumesSuperAdmin(x),
            ChatEventInternalPrevious::ParticipantDismissedAsSuperAdmin(x) => {
                ChatEventInternal::ParticipantDismissedAsSuperAdmin(x)
            }
            ChatEventInternalPrevious::ParticipantRelinquishesSuperAdmin(x) => {
                ChatEventInternal::ParticipantRelinquishesSuperAdmin(x)
            }
            ChatEventInternalPrevious::RoleChanged(x) => ChatEventInternal::RoleChanged(x),
            ChatEventInternalPrevious::UsersBlocked(x) => ChatEventInternal::UsersBlocked(x),
            ChatEventInternalPrevious::UsersUnblocked(x) => ChatEventInternal::UsersUnblocked(x),
            ChatEventInternalPrevious::MessagePinned(x) => ChatEventInternal::MessagePinned(x),
            ChatEventInternalPrevious::MessageUnpinned(x) => ChatEventInternal::MessageUnpinned(x),
            ChatEventInternalPrevious::PermissionsChanged(x) => ChatEventInternal::PermissionsChanged(x),
            ChatEventInternalPrevious::GroupVisibilityChanged(x) => ChatEventInternal::GroupVisibilityChanged(x),
            ChatEventInternalPrevious::GroupInviteCodeChanged(x) => ChatEventInternal::GroupInviteCodeChanged(x),
            ChatEventInternalPrevious::ChatFrozen(x) => ChatEventInternal::ChatFrozen(x),
            ChatEventInternalPrevious::ChatUnfrozen(x) => ChatEventInternal::ChatUnfrozen(x),
            ChatEventInternalPrevious::EventsTimeToLiveUpdated(x) => ChatEventInternal::EventsTimeToLiveUpdated(x),
            ChatEventInternalPrevious::GroupGateUpdated(x) => ChatEventInternal::GroupGateUpdated(x),
            ChatEventInternalPrevious::UsersInvited(x) => ChatEventInternal::UsersInvited(x),
            ChatEventInternalPrevious::MessageEdited(_)
            | ChatEventInternalPrevious::MessageDeleted(_)
            | ChatEventInternalPrevious::MessageUndeleted(_)
            | ChatEventInternalPrevious::MessageReactionAdded(_)
            | ChatEventInternalPrevious::MessageReactionRemoved(_)
            | ChatEventInternalPrevious::PollVoteRegistered(_)
            | ChatEventInternalPrevious::PollVoteDeleted(_)
            | ChatEventInternalPrevious::PollEnded(_)
            | ChatEventInternalPrevious::ThreadUpdated(_)
            | ChatEventInternalPrevious::ProposalsUpdated(_)
            | ChatEventInternalPrevious::Empty => ChatEventInternal::Empty,
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        ChatEventInternal, DeletedByInternal, MessageContentInternal, MessageInternal, ReplyContextInternal,
        ThreadSummaryInternal,
    };
    use candid::Principal;
    use std::collections::HashSet;
    use types::{EventWrapperInternal, Reaction, TextContent};

    #[test]
    fn serialize_with_max_defaults() {
        let message = MessageInternal {
            message_index: 1.into(),
            message_id: 1.into(),
            sender: Principal::from_text("4bkt6-4aaaa-aaaaf-aaaiq-cai").unwrap().into(),
            content: MessageContentInternal::Text(TextContent { text: "123".to_string() }),
            replies_to: None,
            reactions: Vec::new(),
            last_updated: None,
            last_edited: None,
            deleted_by: None,
            thread_summary: None,
            forwarded: false,
        };

        let message_bytes_len = msgpack::serialize_then_unwrap(&message).len();

        let event = EventWrapperInternal {
            index: 1.into(),
            timestamp: 1,
            correlation_id: 0,
            expires_at: None,
            event: ChatEventInternal::Message(Box::new(message)),
        };

        let event_bytes = msgpack::serialize_then_unwrap(&event);
        let event_bytes_len = event_bytes.len();

        // Before optimisation: 177 239
        // After optimisation: 53 65
        assert_eq!(message_bytes_len, 53);
        assert_eq!(event_bytes_len, 65);

        let _deserialized: EventWrapperInternal<ChatEventInternal> = msgpack::deserialize_then_unwrap(&event_bytes);
    }

    #[test]
    fn serialize_with_no_defaults() {
        let principal = Principal::from_text("4bkt6-4aaaa-aaaaf-aaaiq-cai").unwrap();
        let message = MessageInternal {
            message_index: 1.into(),
            message_id: 1.into(),
            sender: principal.into(),
            content: MessageContentInternal::Text(TextContent { text: "123".to_string() }),
            replies_to: Some(ReplyContextInternal {
                event_list_if_other: Some((principal.into(), Some(1.into()))),
                event_index: 1.into(),
            }),
            reactions: vec![(Reaction::new("1".to_string()), HashSet::from([principal.into()]))],
            last_updated: Some(1),
            last_edited: Some(1),
            deleted_by: Some(DeletedByInternal {
                deleted_by: principal.into(),
                timestamp: 1,
            }),
            thread_summary: Some(ThreadSummaryInternal {
                participant_ids: vec![principal.into()],
                reply_count: 1,
                latest_event_index: 1.into(),
                latest_event_timestamp: 1,
            }),
            forwarded: true,
        };

        let message_bytes_len = msgpack::serialize_then_unwrap(&message).len();

        let event = EventWrapperInternal {
            index: 1.into(),
            timestamp: 1,
            correlation_id: 1,
            expires_at: Some(1),
            event: ChatEventInternal::Message(Box::new(message)),
        };

        let event_bytes = msgpack::serialize_then_unwrap(&event);
        let event_bytes_len = event_bytes.len();

        // Before optimisation: 389
        // After optimisation: 150
        assert_eq!(message_bytes_len, 150);

        // Before optimisation: 451
        // After optimisation: 168
        assert_eq!(event_bytes_len, 168);

        let _deserialized: EventWrapperInternal<ChatEventInternal> = msgpack::deserialize_then_unwrap(&event_bytes);
    }
}
