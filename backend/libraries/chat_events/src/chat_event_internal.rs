use crate::incr;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::ops::{Deref, DerefMut};
use types::{
    is_default, is_empty_slice, AvatarChanged, ChatMetrics, Cryptocurrency, DeletedBy, DirectChatCreated,
    EventsTimeToLiveUpdated, GroupCreated, GroupDescriptionChanged, GroupFrozen, GroupGateUpdated, GroupInviteCodeChanged,
    GroupNameChanged, GroupRulesChanged, GroupUnfrozen, GroupVisibilityChanged, MemberJoined, MemberLeft, MembersAdded,
    MembersRemoved, Message, MessageContent, MessageContentInternal, MessageId, MessageIndex, MessagePinned, MessageUnpinned,
    OwnershipTransferred, ParticipantAssumesSuperAdmin, ParticipantDismissedAsSuperAdmin, ParticipantRelinquishesSuperAdmin,
    PermissionsChanged, Reaction, ReplyContext, RoleChanged, ThreadSummary, TimestampMillis, UserId, UsersBlocked,
    UsersInvited, UsersUnblocked,
};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum ChatEventInternal {
    #[serde(rename = "m", alias = "Message")]
    Message(Box<MessageInternal>),
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
    PermissionsChanged(Box<PermissionsChanged>),
    GroupVisibilityChanged(Box<GroupVisibilityChanged>),
    GroupInviteCodeChanged(Box<GroupInviteCodeChanged>),
    ChatFrozen(Box<GroupFrozen>),
    ChatUnfrozen(Box<GroupUnfrozen>),
    EventsTimeToLiveUpdated(Box<EventsTimeToLiveUpdated>),
    GroupGateUpdated(Box<GroupGateUpdated>),
    UsersInvited(Box<UsersInvited>),
    #[serde(other)]
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
    pub replies_to: Option<ReplyContext>,
    #[serde(rename = "r", alias = "reactions", default, skip_serializing_if = "is_empty_slice")]
    pub reactions: Vec<(Reaction, HashSet<UserId>)>,
    #[serde(rename = "u", alias = "last_updated", default, skip_serializing_if = "Option::is_none")]
    pub last_updated: Option<TimestampMillis>,
    #[serde(rename = "e", alias = "last_edited", default, skip_serializing_if = "Option::is_none")]
    pub last_edited: Option<TimestampMillis>,
    #[serde(rename = "d", alias = "deleted_by", default, skip_serializing_if = "Option::is_none")]
    pub deleted_by: Option<DeletedBy>,
    #[serde(rename = "t", alias = "thread_summary", default, skip_serializing_if = "Option::is_none")]
    pub thread_summary: Option<ThreadSummary>,
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

#[cfg(test)]
mod tests {
    use crate::{ChatEventInternal, MessageInternal};
    use candid::Principal;
    use std::collections::HashSet;
    use types::{DeletedBy, EventWrapperInternal, MessageContentInternal, Reaction, ReplyContext, TextContent, ThreadSummary};

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
            replies_to: Some(ReplyContext {
                chat_id_if_other: Some(principal.into()),
                event_list_if_other: Some((principal.into(), Some(1.into()))),
                event_index: 1.into(),
            }),
            reactions: vec![(Reaction::new("1".to_string()), HashSet::from([principal.into()]))],
            last_updated: Some(1),
            last_edited: Some(1),
            deleted_by: Some(DeletedBy {
                deleted_by: principal.into(),
                timestamp: 1,
            }),
            thread_summary: Some(ThreadSummary {
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

        // Before optimisation: 389 451
        // After optimisation: 286 304
        assert_eq!(message_bytes_len, 286);
        assert_eq!(event_bytes_len, 304);

        let _deserialized: EventWrapperInternal<ChatEventInternal> = msgpack::deserialize_then_unwrap(&event_bytes);
    }
}
