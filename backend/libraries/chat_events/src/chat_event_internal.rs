use crate::{incr, MessageContentInternal};
use serde::{Deserialize, Serialize};
use std::cmp::max;
use std::collections::{HashMap, HashSet};
use std::ops::DerefMut;
use types::{
    is_default, AccessGate, AccessGateConfigInternal, AvatarChanged, ChannelId, Chat, ChatId, ChatMetrics, CommunityId,
    Cryptocurrency, DeletedBy, DirectChatCreated, EventIndex, EventWrapperInternal, EventsTimeToLiveUpdated,
    ExternalUrlUpdated, GroupCreated, GroupDescriptionChanged, GroupFrozen, GroupGateUpdated, GroupInviteCodeChanged,
    GroupNameChanged, GroupReplyContext, GroupRulesChanged, GroupUnfrozen, GroupVisibilityChanged, MemberJoined, MemberLeft,
    MembersAdded, MembersAddedToDefaultChannel, MembersRemoved, Message, MessageContent, MessageId, MessageIndex,
    MessagePinned, MessageUnpinned, MultiUserChat, PermissionsChanged, PushIfNotContains, Reaction, ReplyContext, RoleChanged,
    ThreadSummary, TimestampMillis, Timestamped, Tips, UserId, UsersBlocked, UsersInvited, UsersUnblocked,
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
    GroupGateUpdated(Box<GroupGateUpdatedInternal>),
    #[serde(rename = "ui")]
    UsersInvited(Box<UsersInvited>),
    #[serde(rename = "adc")]
    MembersAddedToPublicChannel(Box<MembersAddedToPublicChannelInternal>),
    #[serde(rename = "xu")]
    ExternalUrlUpdated(Box<ExternalUrlUpdated>),
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
                | ChatEventInternal::ExternalUrlUpdated(_)
        )
    }

    pub fn is_valid_for_thread(&self) -> bool {
        self.is_message()
    }

    pub fn is_message(&self) -> bool {
        matches!(self, ChatEventInternal::Message(_))
    }

    pub fn as_message_mut(&mut self) -> Option<&mut MessageInternal> {
        if let ChatEventInternal::Message(m) = self {
            Some(m.deref_mut())
        } else {
            None
        }
    }

    pub fn into_message(self) -> Option<MessageInternal> {
        if let ChatEventInternal::Message(m) = self {
            Some(*m)
        } else {
            None
        }
    }
}

pub enum EventOrExpiredRangeInternal {
    Event(EventWrapperInternal<ChatEventInternal>),
    ExpiredEventRange(EventIndex, EventIndex),
}

impl EventOrExpiredRangeInternal {
    pub fn into_event(self) -> Option<EventWrapperInternal<ChatEventInternal>> {
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
    #[serde(rename = "r", default, skip_serializing_if = "Vec::is_empty")]
    pub reactions: Vec<(Reaction, HashSet<UserId>)>,
    #[serde(rename = "ti", default, skip_serializing_if = "Vec::is_empty")]
    pub tips: Tips,
    #[serde(rename = "e", default, skip_serializing_if = "Option::is_none")]
    pub last_edited: Option<TimestampMillis>,
    #[serde(rename = "d", default, skip_serializing_if = "Option::is_none")]
    pub deleted_by: Option<DeletedByInternal>,
    #[serde(rename = "t", default, skip_serializing_if = "Option::is_none")]
    pub thread_summary: Option<ThreadSummaryInternal>,
    #[serde(rename = "f", default, skip_serializing_if = "is_default")]
    pub forwarded: bool,
    #[serde(rename = "b", default, skip_serializing_if = "is_default")]
    pub block_level_markdown: bool,
}

impl MessageInternal {
    pub fn hydrate(self, my_user_id: Option<UserId>) -> Message {
        Message {
            message_index: self.message_index,
            message_id: self.message_id,
            sender: self.sender,
            content: if let Some(deleted_by) = self.deleted_by {
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
            block_level_markdown: self.block_level_markdown,
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
            MessageContentInternal::P2PSwap(_) => incr(&mut metrics.p2p_swaps),
            MessageContentInternal::VideoCall(_) => incr(&mut metrics.video_calls),
            MessageContentInternal::Custom(_) => {
                incr(&mut metrics.custom_type_messages);
            }
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

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GroupGateUpdatedInternalPrevious {
    pub updated_by: UserId,
    pub new_gate: Option<AccessGate>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GroupGateUpdatedInternal {
    pub updated_by: UserId,
    pub new_gate_config: Option<AccessGateConfigInternal>,
}

impl From<GroupGateUpdatedInternal> for GroupGateUpdated {
    fn from(value: GroupGateUpdatedInternal) -> Self {
        GroupGateUpdated {
            updated_by: value.updated_by,
            new_gate: value.new_gate_config.clone().map(|gc| gc.gate),
            new_gate_config: value.new_gate_config.map(|gc| gc.into()),
        }
    }
}

impl From<&MembersAddedToPublicChannelInternal> for MembersAddedToDefaultChannel {
    fn from(value: &MembersAddedToPublicChannelInternal) -> MembersAddedToDefaultChannel {
        MembersAddedToDefaultChannel {
            count: value.user_ids.len() as u32,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(from = "ThreadSummaryInternalCombined")]
pub struct ThreadSummaryInternal {
    #[serde(rename = "p")]
    pub participants: Vec<UserId>,
    #[serde(rename = "f")]
    pub followers: HashSet<UserId>,
    #[serde(rename = "r")]
    pub reply_count: u32,
    #[serde(rename = "e")]
    pub latest_event_index: EventIndex,
    #[serde(rename = "t")]
    pub latest_event_timestamp: TimestampMillis,
}

#[derive(Serialize, Deserialize)]
#[serde(untagged)]
enum Followers {
    Old(HashMap<UserId, Timestamped<bool>>),
    New(HashSet<UserId>),
}

#[derive(Serialize, Deserialize)]
pub struct ThreadSummaryInternalCombined {
    #[serde(rename = "p", alias = "i")]
    participants: Vec<UserId>,
    #[serde(rename = "f")]
    followers: Followers,
    #[serde(rename = "r")]
    reply_count: u32,
    #[serde(rename = "e")]
    latest_event_index: EventIndex,
    #[serde(rename = "t")]
    latest_event_timestamp: TimestampMillis,
}

impl From<ThreadSummaryInternalCombined> for ThreadSummaryInternal {
    fn from(value: ThreadSummaryInternalCombined) -> Self {
        let followers = match value.followers {
            Followers::Old(map) => {
                let mut followers: HashSet<_> = value.participants.iter().copied().collect();
                for (user_id, following) in map {
                    if following.value {
                        followers.insert(user_id);
                    } else {
                        followers.remove(&user_id);
                    }
                }
                followers
            }
            Followers::New(set) => set,
        };

        ThreadSummaryInternal {
            participants: value.participants,
            followers,
            reply_count: value.reply_count,
            latest_event_index: value.latest_event_index,
            latest_event_timestamp: value.latest_event_timestamp,
        }
    }
}

impl ThreadSummaryInternal {
    pub fn hydrate(&self, my_user_id: Option<UserId>) -> ThreadSummary {
        ThreadSummary {
            participant_ids: self.participants.clone(),
            followed_by_me: my_user_id.map_or(false, |u| self.followers.contains(&u)),
            reply_count: self.reply_count,
            latest_event_index: self.latest_event_index,
            latest_event_timestamp: self.latest_event_timestamp,
        }
    }

    pub fn mark_message_added(
        &mut self,
        sender: UserId,
        mentioned_users: &[UserId],
        latest_event_index: EventIndex,
        now: TimestampMillis,
    ) {
        self.latest_event_index = latest_event_index;
        self.latest_event_timestamp = now;
        self.reply_count += 1;
        self.participants.push_if_not_contains(sender);
        self.followers.insert(sender);

        // If a user is mentioned in a thread they automatically become a follower
        for user_id in mentioned_users {
            self.followers.insert(*user_id);
        }
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
    #[serde(rename = "p2p", default, skip_serializing_if = "is_default")]
    pub p2p_swaps: u64,
    #[serde(rename = "vc", default, skip_serializing_if = "is_default")]
    pub video_calls: u64,
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
        TextContentInternal, ThreadSummaryInternal,
    };
    use candid::Principal;
    use std::collections::HashSet;
    use types::{EventWrapperInternal, Reaction, Tips};

    #[test]
    fn serialize_with_max_defaults() {
        let message = MessageInternal {
            message_index: 1.into(),
            message_id: 1.into(),
            sender: Principal::from_text("4bkt6-4aaaa-aaaaf-aaaiq-cai").unwrap().into(),
            content: MessageContentInternal::Text(TextContentInternal { text: "123".to_string() }),
            replies_to: None,
            reactions: Vec::new(),
            tips: Tips::default(),
            last_edited: None,
            deleted_by: None,
            thread_summary: None,
            forwarded: false,
            block_level_markdown: false,
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

        assert_eq!(message_bytes_len, 33);
        assert_eq!(event_bytes_len, message_bytes_len + 12);

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
            content: MessageContentInternal::Text(TextContentInternal { text: "123".to_string() }),
            replies_to: Some(ReplyContextInternal {
                chat_if_other: Some((ChatInternal::Group(principal.into()), Some(1.into()))),
                event_index: 1.into(),
            }),
            reactions: vec![(Reaction::new("1".to_string()), HashSet::from([principal.into()]))],
            tips,
            last_edited: Some(1),
            deleted_by: Some(DeletedByInternal {
                deleted_by: principal.into(),
                timestamp: 1,
            }),
            thread_summary: Some(ThreadSummaryInternal {
                participants: vec![principal.into()],
                followers: HashSet::new(),
                reply_count: 1,
                latest_event_index: 1.into(),
                latest_event_timestamp: 1,
            }),
            forwarded: true,
            block_level_markdown: false,
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

        assert_eq!(message_bytes_len, 165);
        assert_eq!(event_bytes_len, message_bytes_len + 18);

        let _deserialized: EventWrapperInternal<ChatEventInternal> = msgpack::deserialize_then_unwrap(&event_bytes);
    }
}
