use crate::incr;
use ic_ledger_types::Tokens;
use ledger_utils::format_crypto_amount;
use search::Document;
use serde::{Deserialize, Serialize};
use std::cmp::max;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::{HashMap, HashSet};
use std::ops::{Deref, DerefMut};
use types::{
    is_default, is_empty_hashset, is_empty_slice, AudioContent, AvatarChanged, BlobReference, CanisterId, ChannelId, Chat,
    ChatId, ChatMetrics, CommunityId, CompletedCryptoTransaction, CryptoContent, CryptoTransaction, Cryptocurrency,
    CustomContent, DeletedBy, DirectChatCreated, EventIndex, EventWrapperInternal, EventsTimeToLiveUpdated, FileContent,
    GiphyContent, GroupCreated, GroupDescriptionChanged, GroupFrozen, GroupGateUpdated, GroupInviteCodeChanged,
    GroupNameChanged, GroupReplyContext, GroupRulesChanged, GroupUnfrozen, GroupVisibilityChanged, ImageContent, MemberJoined,
    MemberLeft, MembersAdded, MembersAddedToDefaultChannel, MembersRemoved, Message, MessageContent, MessageContentInitial,
    MessageId, MessageIndex, MessagePinned, MessageReminderContent, MessageReminderCreatedContent, MessageUnpinned,
    MultiUserChat, PermissionsChanged, PollContentInternal, PrizeContent, PrizeContentInitial, PrizeWinnerContent, Proposal,
    ProposalContent, Reaction, ReplyContext, ReportedMessage, ReportedMessageInternal, RoleChanged, TextContent, ThreadSummary,
    TimestampMillis, Timestamped, Tips, UserId, UsersBlocked, UsersInvited, UsersUnblocked, VideoContent,
};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum ChatEventInternal {
    #[serde(rename = "m")]
    Message(Box<MessageInternal>),
    #[serde(rename = "dcc")]
    DirectChatCreated(DirectChatCreated),
    #[serde(rename = "gcc")]
    GroupChatCreated(Box<GroupCreated>),
    #[serde(rename = "nc")]
    GroupNameChanged(Box<GroupNameChanged>),
    #[serde(rename = "dc")]
    GroupDescriptionChanged(Box<GroupDescriptionChanged>),
    #[serde(rename = "grc")]
    GroupRulesChanged(Box<GroupRulesChanged>),
    #[serde(rename = "ac")]
    AvatarChanged(Box<AvatarChanged>),
    #[serde(rename = "ma")]
    ParticipantsAdded(Box<MembersAdded>),
    #[serde(rename = "mr")]
    ParticipantsRemoved(Box<MembersRemoved>),
    #[serde(rename = "mj")]
    ParticipantJoined(Box<MemberJoined>),
    #[serde(rename = "ml")]
    ParticipantLeft(Box<MemberLeft>),
    #[serde(rename = "rc")]
    RoleChanged(Box<RoleChanged>),
    #[serde(rename = "ub")]
    UsersBlocked(Box<UsersBlocked>),
    #[serde(rename = "uub")]
    UsersUnblocked(Box<UsersUnblocked>),
    #[serde(rename = "mp")]
    MessagePinned(Box<MessagePinned>),
    #[serde(rename = "mup")]
    MessageUnpinned(Box<MessageUnpinned>),
    #[serde(rename = "pc")]
    PermissionsChanged(Box<PermissionsChanged>),
    #[serde(rename = "vc")]
    GroupVisibilityChanged(Box<GroupVisibilityChanged>),
    #[serde(rename = "icc")]
    GroupInviteCodeChanged(Box<GroupInviteCodeChanged>),
    #[serde(rename = "fz")]
    ChatFrozen(Box<GroupFrozen>),
    #[serde(rename = "ufz")]
    ChatUnfrozen(Box<GroupUnfrozen>),
    #[serde(rename = "ttl")]
    EventsTimeToLiveUpdated(Box<EventsTimeToLiveUpdated>),
    #[serde(rename = "gu")]
    GroupGateUpdated(Box<GroupGateUpdated>),
    #[serde(rename = "ui")]
    UsersInvited(Box<UsersInvited>),
    #[serde(rename = "adc")]
    MembersAddedToPublicChannel(Box<MembersAddedToPublicChannelInternal>),
    #[serde(rename = "e")]
    Empty,
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
                | ChatEventInternal::ParticipantsAdded(_)
                | ChatEventInternal::ParticipantsRemoved(_)
                | ChatEventInternal::ParticipantJoined(_)
                | ChatEventInternal::ParticipantLeft(_)
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
                | ChatEventInternal::MembersAddedToPublicChannel(_)
        )
    }

    pub fn is_valid_for_thread(&self) -> bool {
        self.is_message()
    }

    pub fn is_message(&self) -> bool {
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

pub enum EventOrExpiredRangeInternal<'a> {
    Event(&'a EventWrapperInternal<ChatEventInternal>),
    ExpiredEventRange(EventIndex, EventIndex),
}

impl<'a> EventOrExpiredRangeInternal<'a> {
    pub fn as_event(self) -> Option<&'a EventWrapperInternal<ChatEventInternal>> {
        if let EventOrExpiredRangeInternal::Event(event) = self {
            Some(event)
        } else {
            None
        }
    }

    pub fn is_message(&self) -> bool {
        if let EventOrExpiredRangeInternal::Event(event) = self {
            event.event.is_message()
        } else {
            false
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MessageInternal {
    #[serde(rename = "x")]
    pub message_index: MessageIndex,
    #[serde(rename = "i")]
    pub message_id: MessageId,
    #[serde(rename = "s")]
    pub sender: UserId,
    #[serde(rename = "c")]
    pub content: MessageContentInternal,
    #[serde(rename = "p", default, skip_serializing_if = "Option::is_none")]
    pub replies_to: Option<ReplyContextInternal>,
    #[serde(rename = "r", default, skip_serializing_if = "is_empty_slice")]
    pub reactions: Vec<(Reaction, HashSet<UserId>)>,
    #[serde(rename = "ti", default, skip_serializing_if = "is_empty_slice")]
    pub tips: Tips,
    #[serde(rename = "u", default, skip_serializing_if = "Option::is_none")]
    pub last_updated: Option<TimestampMillis>,
    #[serde(rename = "e", default, skip_serializing_if = "Option::is_none")]
    pub last_edited: Option<TimestampMillis>,
    #[serde(rename = "d", default, skip_serializing_if = "Option::is_none")]
    pub deleted_by: Option<DeletedByInternal>,
    #[serde(rename = "t", default, skip_serializing_if = "Option::is_none")]
    pub thread_summary: Option<ThreadSummaryInternal>,
    #[serde(rename = "f", default, skip_serializing_if = "is_default")]
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
            tips: self.tips.clone(),
            edited: self.last_edited.is_some(),
            forwarded: self.forwarded,
            thread_summary: self.thread_summary.as_ref().map(|t| t.hydrate(my_user_id)),
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
                Cryptocurrency::KINIC => {
                    incr(&mut metrics.kinic_messages);
                }
                Cryptocurrency::Other(_) => {
                    incr(&mut metrics.other_crypto_messages);
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
    #[serde(rename = "t")]
    Text(TextContent),
    #[serde(rename = "i")]
    Image(ImageContent),
    #[serde(rename = "v")]
    Video(VideoContent),
    #[serde(rename = "a")]
    Audio(AudioContent),
    #[serde(rename = "f")]
    File(FileContent),
    #[serde(rename = "p")]
    Poll(PollContentInternal),
    #[serde(rename = "c")]
    Crypto(CryptoContentInternal),
    #[serde(rename = "d")]
    Deleted(DeletedByInternal),
    #[serde(rename = "g")]
    Giphy(GiphyContent),
    #[serde(rename = "gp")]
    GovernanceProposal(ProposalContentInternal),
    #[serde(rename = "pr")]
    Prize(PrizeContentInternal),
    #[serde(rename = "pw")]
    PrizeWinner(PrizeWinnerContent),
    #[serde(rename = "mrc")]
    MessageReminderCreated(MessageReminderCreatedContent),
    #[serde(rename = "mr")]
    MessageReminder(MessageReminderContent),
    #[serde(rename = "rm")]
    ReportedMessage(ReportedMessageInternal),
    #[serde(rename = "cu")]
    Custom(CustomContent),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProposalContentInternal {
    pub governance_canister_id: CanisterId,
    pub proposal: Proposal,
    pub votes: HashMap<UserId, bool>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CryptoContentInternal {
    #[serde(rename = "r")]
    pub recipient: UserId,
    #[serde(rename = "t")]
    pub transfer: CompletedCryptoTransaction,
    #[serde(rename = "c", default, skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
}

impl From<CryptoContentInternal> for CryptoContent {
    fn from(value: CryptoContentInternal) -> Self {
        CryptoContent {
            recipient: value.recipient,
            transfer: CryptoTransaction::Completed(value.transfer),
            caption: value.caption,
        }
    }
}

impl TryFrom<CryptoContent> for CryptoContentInternal {
    type Error = ();

    fn try_from(value: CryptoContent) -> Result<Self, Self::Error> {
        if let CryptoTransaction::Completed(transfer) = value.transfer {
            Ok(CryptoContentInternal {
                recipient: value.recipient,
                transfer,
                caption: value.caption,
            })
        } else {
            Err(())
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PrizeContentInternal {
    #[serde(rename = "p", default, skip_serializing_if = "is_empty_slice")]
    pub prizes_remaining: Vec<Tokens>,
    #[serde(rename = "r", default, skip_serializing_if = "is_empty_hashset")]
    pub reservations: HashSet<UserId>,
    #[serde(rename = "w")]
    pub winners: HashSet<UserId>,
    #[serde(rename = "t")]
    pub transaction: CompletedCryptoTransaction,
    #[serde(rename = "e")]
    pub end_date: TimestampMillis,
    #[serde(rename = "c", default, skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
    #[serde(rename = "d", default, skip_serializing_if = "is_default")]
    pub diamond_only: bool,
}

impl From<&PrizeContentInternal> for PrizeContent {
    fn from(value: &PrizeContentInternal) -> Self {
        PrizeContent {
            prizes_remaining: value.prizes_remaining.len() as u32,
            prizes_pending: value.reservations.len() as u32,
            winners: value.winners.iter().copied().collect(),
            token: value.transaction.token(),
            end_date: value.end_date,
            caption: value.caption.clone(),
            diamond_only: value.diamond_only,
        }
    }
}

impl TryFrom<PrizeContentInitial> for PrizeContentInternal {
    type Error = ();

    fn try_from(value: PrizeContentInitial) -> Result<Self, Self::Error> {
        if let CryptoTransaction::Completed(transaction) = value.transfer {
            Ok(PrizeContentInternal {
                prizes_remaining: value.prizes,
                reservations: HashSet::new(),
                winners: HashSet::new(),
                transaction,
                end_date: value.end_date,
                caption: value.caption,
                diamond_only: value.diamond_only,
            })
        } else {
            Err(())
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DeletedByInternal {
    #[serde(rename = "d")]
    pub deleted_by: UserId,
    #[serde(rename = "t")]
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

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MembersAddedToPublicChannelInternal {
    #[serde(rename = "u")]
    pub user_ids: Vec<UserId>,
}

impl From<&MembersAddedToPublicChannelInternal> for MembersAddedToDefaultChannel {
    fn from(value: &MembersAddedToPublicChannelInternal) -> MembersAddedToDefaultChannel {
        MembersAddedToDefaultChannel {
            count: value.user_ids.len() as u32,
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
            MessageContentInternal::Crypto(c) => MessageContent::Crypto(c.clone().into()),
            MessageContentInternal::Deleted(d) => MessageContent::Deleted(d.hydrate()),
            MessageContentInternal::Giphy(g) => MessageContent::Giphy(g.clone()),
            MessageContentInternal::PrizeWinner(c) => MessageContent::PrizeWinner(c.clone()),
            MessageContentInternal::GovernanceProposal(p) => MessageContent::GovernanceProposal(ProposalContent {
                governance_canister_id: p.governance_canister_id,
                proposal: p.proposal.clone(),
                my_vote: my_user_id.and_then(|u| p.votes.get(&u)).copied(),
            }),
            MessageContentInternal::Prize(p) => MessageContent::Prize(p.into()),
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
    #[serde(rename = "i")]
    pub participant_ids: Vec<UserId>,
    #[serde(default, rename = "f")]
    pub follower_ids: HashMap<UserId, Timestamped<bool>>,
    #[serde(rename = "r")]
    pub reply_count: u32,
    #[serde(rename = "e")]
    pub latest_event_index: EventIndex,
    #[serde(rename = "t")]
    pub latest_event_timestamp: TimestampMillis,
}

impl ThreadSummaryInternal {
    pub fn hydrate(&self, my_user_id: Option<UserId>) -> ThreadSummary {
        ThreadSummary {
            participant_ids: self.participant_ids.clone(),
            followed_by_me: my_user_id.map_or(false, |u| self.follower_ids.get(&u).map_or(false, |t| t.value)),
            reply_count: self.reply_count,
            latest_event_index: self.latest_event_index,
            latest_event_timestamp: self.latest_event_timestamp,
        }
    }

    pub fn set_follow(&mut self, user_id: UserId, now: TimestampMillis, follow: bool) -> bool {
        let new_entry = Timestamped::new(follow, now);
        match self.follower_ids.entry(user_id) {
            Occupied(mut e) => {
                if e.get().value == follow {
                    false
                } else {
                    e.insert(new_entry);
                    true
                }
            }
            Vacant(e) => {
                e.insert(new_entry);
                true
            }
        }
    }

    pub fn participants_and_followers(&self, include_unfollowed: bool) -> Vec<UserId> {
        self.participant_ids
            .iter()
            .copied()
            .chain(
                self.follower_ids
                    .iter()
                    .filter(|(_, t)| include_unfollowed || t.value)
                    .map(|(user_id, _)| *user_id),
            )
            .collect()
    }

    pub fn get_follower(&self, user_id: UserId) -> Option<Timestamped<bool>> {
        self.follower_ids.get(&user_id).cloned()
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
            MessageContentInitial::Crypto(c) => MessageContentInternal::Crypto(c.try_into().unwrap()),
            MessageContentInitial::Deleted(d) => MessageContentInternal::Deleted(d.into()),
            MessageContentInitial::Giphy(g) => MessageContentInternal::Giphy(g),
            MessageContentInitial::GovernanceProposal(p) => {
                MessageContentInternal::GovernanceProposal(ProposalContentInternal {
                    governance_canister_id: p.governance_canister_id,
                    proposal: p.proposal,
                    votes: HashMap::new(),
                })
            }
            MessageContentInitial::Prize(p) => MessageContentInternal::Prize(p.try_into().unwrap()),
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

                let amount = c.transfer.units();
                // This is only used for string searching so it's better to default to 8 than to trap
                let decimals = c.transfer.token().decimals().unwrap_or(8);
                let amount_string = format_crypto_amount(amount, decimals);
                document.add_field(amount_string, 1.0, false);

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

#[derive(Serialize, Deserialize, Debug, Eq, PartialEq, Hash, Clone, Copy)]
pub enum ChatInternal {
    #[serde(rename = "d")]
    Direct(ChatId),
    #[serde(rename = "g")]
    Group(ChatId),
    #[serde(rename = "c")]
    Channel(CommunityId, ChannelId),
}

impl From<Chat> for ChatInternal {
    fn from(value: Chat) -> Self {
        match value {
            Chat::Direct(c) => ChatInternal::Direct(c),
            Chat::Group(c) => ChatInternal::Group(c),
            Chat::Channel(cm, ch) => ChatInternal::Channel(cm, ch),
        }
    }
}

impl From<MultiUserChat> for ChatInternal {
    fn from(value: MultiUserChat) -> Self {
        match value {
            MultiUserChat::Group(c) => ChatInternal::Group(c),
            MultiUserChat::Channel(cm, ch) => ChatInternal::Channel(cm, ch),
        }
    }
}

impl ChatInternal {
    pub fn hydrate(&self) -> Chat {
        match self {
            ChatInternal::Direct(c) => Chat::Direct(*c),
            ChatInternal::Group(c) => Chat::Group(*c),
            ChatInternal::Channel(cm, ch) => Chat::Channel(*cm, *ch),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ReplyContextInternal {
    #[serde(rename = "c")]
    pub chat_if_other: Option<(ChatInternal, Option<MessageIndex>)>,
    #[serde(rename = "e")]
    pub event_index: EventIndex,
}

impl ReplyContextInternal {
    pub fn hydrate(&self) -> ReplyContext {
        ReplyContext {
            chat_if_other: self.chat_if_other.as_ref().map(|(c, t)| (c.hydrate(), *t)),
            event_index: self.event_index,
        }
    }
}

impl From<&GroupReplyContext> for ReplyContextInternal {
    fn from(value: &GroupReplyContext) -> Self {
        ReplyContextInternal {
            chat_if_other: None,
            event_index: value.event_index,
        }
    }
}

impl From<&ReplyContext> for ReplyContextInternal {
    fn from(value: &ReplyContext) -> Self {
        ReplyContextInternal {
            chat_if_other: value.chat_if_other.map(|(c, t)| (c.into(), t)),
            event_index: value.event_index,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct ChatMetricsInternal {
    #[serde(rename = "t", default, skip_serializing_if = "is_default")]
    pub text_messages: u64,
    #[serde(rename = "i", default, skip_serializing_if = "is_default")]
    pub image_messages: u64,
    #[serde(rename = "v", default, skip_serializing_if = "is_default")]
    pub video_messages: u64,
    #[serde(rename = "a", default, skip_serializing_if = "is_default")]
    pub audio_messages: u64,
    #[serde(rename = "f", default, skip_serializing_if = "is_default")]
    pub file_messages: u64,
    #[serde(rename = "p", default, skip_serializing_if = "is_default")]
    pub polls: u64,
    #[serde(rename = "pv", default, skip_serializing_if = "is_default")]
    pub poll_votes: u64,
    #[serde(rename = "icp", default, skip_serializing_if = "is_default")]
    pub icp_messages: u64,
    #[serde(rename = "sns1", default, skip_serializing_if = "is_default")]
    pub sns1_messages: u64,
    #[serde(rename = "ckbtc", default, skip_serializing_if = "is_default")]
    pub ckbtc_messages: u64,
    #[serde(rename = "chat", default, skip_serializing_if = "is_default")]
    pub chat_messages: u64,
    #[serde(rename = "kinic", default, skip_serializing_if = "is_default")]
    pub kinic_messages: u64,
    #[serde(rename = "o", default, skip_serializing_if = "is_default")]
    pub other_crypto_messages: u64,
    #[serde(rename = "d", default, skip_serializing_if = "is_default")]
    pub deleted_messages: u64,
    #[serde(rename = "g", default, skip_serializing_if = "is_default")]
    pub giphy_messages: u64,
    #[serde(rename = "pz", default, skip_serializing_if = "is_default")]
    pub prize_messages: u64,
    #[serde(rename = "pzw", default, skip_serializing_if = "is_default")]
    pub prize_winner_messages: u64,
    #[serde(rename = "rp", default, skip_serializing_if = "is_default")]
    pub replies: u64,
    #[serde(rename = "e", default, skip_serializing_if = "is_default")]
    pub edits: u64,
    #[serde(rename = "rt", default, skip_serializing_if = "is_default")]
    pub reactions: u64,
    #[serde(rename = "ti", default, skip_serializing_if = "is_default")]
    pub tips: u64,
    #[serde(rename = "pr", default, skip_serializing_if = "is_default")]
    pub proposals: u64,
    #[serde(rename = "rpt", default, skip_serializing_if = "is_default")]
    pub reported_messages: u64,
    #[serde(rename = "mr", default, skip_serializing_if = "is_default")]
    pub message_reminders: u64,
    #[serde(rename = "cu", default, skip_serializing_if = "is_default")]
    pub custom_type_messages: u64,
    #[serde(rename = "la")]
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
        self.kinic_messages += other.kinic_messages;
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
            kinic_messages: self.kinic_messages,
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

#[cfg(test)]
mod tests {
    use crate::{
        ChatEventInternal, ChatInternal, DeletedByInternal, MessageContentInternal, MessageInternal, ReplyContextInternal,
        ThreadSummaryInternal,
    };
    use candid::Principal;
    use std::collections::{HashMap, HashSet};
    use types::{EventWrapperInternal, Reaction, TextContent, Tips};

    #[test]
    fn serialize_with_max_defaults() {
        let message = MessageInternal {
            message_index: 1.into(),
            message_id: 1.into(),
            sender: Principal::from_text("4bkt6-4aaaa-aaaaf-aaaiq-cai").unwrap().into(),
            content: MessageContentInternal::Text(TextContent { text: "123".to_string() }),
            replies_to: None,
            reactions: Vec::new(),
            tips: Tips::default(),
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

        // Before optimisation: 177
        // After optimisation: 53
        assert_eq!(message_bytes_len, 53);

        // Before optimisation: 239
        // After optimisation: 65
        assert_eq!(event_bytes_len, 65);

        let _deserialized: EventWrapperInternal<ChatEventInternal> = msgpack::deserialize_then_unwrap(&event_bytes);
    }

    #[test]
    fn serialize_with_no_defaults() {
        let principal = Principal::from_text("4bkt6-4aaaa-aaaaf-aaaiq-cai").unwrap();
        let mut tips = Tips::default();
        tips.push(principal, principal.into(), 1);
        let message = MessageInternal {
            message_index: 1.into(),
            message_id: 1.into(),
            sender: principal.into(),
            content: MessageContentInternal::Text(TextContent { text: "123".to_string() }),
            replies_to: Some(ReplyContextInternal {
                chat_if_other: Some((ChatInternal::Group(principal.into()), Some(1.into()))),
                event_index: 1.into(),
            }),
            reactions: vec![(Reaction::new("1".to_string()), HashSet::from([principal.into()]))],
            tips,
            last_updated: Some(1),
            last_edited: Some(1),
            deleted_by: Some(DeletedByInternal {
                deleted_by: principal.into(),
                timestamp: 1,
            }),
            thread_summary: Some(ThreadSummaryInternal {
                participant_ids: vec![principal.into()],
                follower_ids: HashMap::new(),
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

        // Before optimisation: 438
        // After optimisation: 205
        assert_eq!(message_bytes_len, 205);

        // Before optimisation: 500
        // After optimisation: 223
        assert_eq!(event_bytes_len, 223);

        let _deserialized: EventWrapperInternal<ChatEventInternal> = msgpack::deserialize_then_unwrap(&event_bytes);
    }
}
