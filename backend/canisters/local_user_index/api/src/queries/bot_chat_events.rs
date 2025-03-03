use crate::chat_events::EventsSelectionCriteria;
use candid::Deserialize;
use serde::Serialize;
use ts_export::ts_export;
use types::{
    AudioContent, AuthToken, AvatarChanged, BotAdded, BotMessageContext, BotRemoved, BotUpdated, ChannelId, CryptoContent,
    CustomContent, DeletedBy, DirectChatCreated, EventIndex, EventWrapper, EventsTimeToLiveUpdated, ExternalUrlUpdated,
    FileContent, GiphyContent, GroupCreated, GroupDescriptionChanged, GroupFrozen, GroupGateUpdated, GroupInviteCodeChanged,
    GroupNameChanged, GroupRulesChanged, GroupUnfrozen, GroupVisibilityChanged, ImageContent, MemberJoined, MemberLeft,
    MembersAdded, MembersAddedToDefaultChannel, MembersRemoved, MessageId, MessageIndex, MessagePinned, MessageUnpinned,
    PermissionsChanged, PollContent, Reaction, ReplyContext, RoleChanged, TextContent, ThreadSummary, TimestampMillis, Tips,
    UserId, UsersBlocked, UsersInvited, UsersUnblocked, VideoContent,
};
use user_canister::token_swap_status::CandidType;

#[ts_export(local_user_index, bot_chat_events)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: Option<ChannelId>,
    pub events: EventsSelectionCriteria,
    pub auth_token: AuthToken,
}

#[ts_export(local_user_index, chat_events)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(EventsResponse),
    FailedAuthentication(String),
    NotAuthorized,
    NotFound,
    InternalError(String),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct EventsResponse {
    #[ts(as = "Vec<types::EventWrapperChatEvent>")]
    pub events: Vec<EventWrapper<ChatEvent>>,
    pub unauthorized: Vec<EventIndex>,
    pub expired_event_ranges: Vec<(EventIndex, EventIndex)>,
    pub expired_message_ranges: Vec<(MessageIndex, MessageIndex)>,
    pub latest_event_index: EventIndex,
    pub chat_last_updated: TimestampMillis,
}

#[ts_export]
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
    ParticipantsAdded(MembersAdded),
    ParticipantsRemoved(MembersRemoved),
    ParticipantJoined(MemberJoined),
    ParticipantLeft(MemberLeft),
    RoleChanged(RoleChanged),
    UsersBlocked(UsersBlocked),
    UsersUnblocked(UsersUnblocked),
    MessagePinned(MessagePinned),
    MessageUnpinned(MessageUnpinned),
    PermissionsChanged(PermissionsChanged),
    GroupVisibilityChanged(GroupVisibilityChanged),
    GroupInviteCodeChanged(GroupInviteCodeChanged),
    ChatFrozen(GroupFrozen),
    ChatUnfrozen(GroupUnfrozen),
    EventsTimeToLiveUpdated(EventsTimeToLiveUpdated),
    GroupGateUpdated(GroupGateUpdated),
    UsersInvited(UsersInvited),
    MembersAddedToDefaultChannel(MembersAddedToDefaultChannel),
    ExternalUrlUpdated(ExternalUrlUpdated),
    BotAdded(BotAdded),
    BotRemoved(BotRemoved),
    BotUpdated(BotUpdated),
    FailedToDeserialize,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Message {
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sender: UserId,
    pub content: MessageContent,
    pub bot_context: Option<BotMessageContext>,
    pub replies_to: Option<ReplyContext>,
    pub reactions: Vec<(Reaction, Vec<UserId>)>,
    pub tips: Tips,
    pub thread_summary: Option<ThreadSummary>,
    pub edited: bool,
    pub forwarded: bool,
    pub block_level_markdown: bool,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum MessageContent {
    Text(TextContent),
    Image(ImageContent),
    Video(VideoContent),
    Audio(AudioContent),
    File(FileContent),
    Poll(PollContent),
    Crypto(CryptoContent),
    Deleted(DeletedBy),
    Giphy(GiphyContent),
    Custom(CustomContent),
    Unsupported(UnsupportedContent),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UnsupportedContent {
    pub kind: String,
}

impl From<types::EventsResponse> for EventsResponse {
    fn from(value: types::EventsResponse) -> Self {
        Self {
            events: value
                .events
                .into_iter()
                .map(|event| EventWrapper {
                    index: event.index,
                    timestamp: event.timestamp,
                    correlation_id: event.correlation_id,
                    expires_at: event.expires_at,
                    event: event.event.into(),
                })
                .collect(),
            unauthorized: value.unauthorized,
            expired_event_ranges: value.expired_event_ranges,
            expired_message_ranges: value.expired_message_ranges,
            latest_event_index: value.latest_event_index,
            chat_last_updated: value.chat_last_updated,
        }
    }
}

impl From<types::ChatEvent> for ChatEvent {
    fn from(value: types::ChatEvent) -> Self {
        match value {
            types::ChatEvent::Empty => Self::Empty,
            types::ChatEvent::Message(message) => Self::Message(Box::new((*message).into())),
            types::ChatEvent::GroupChatCreated(group_chat_created) => Self::GroupChatCreated(group_chat_created),
            types::ChatEvent::DirectChatCreated(direct_chat_created) => Self::DirectChatCreated(direct_chat_created),
            types::ChatEvent::GroupNameChanged(group_name_changed) => Self::GroupNameChanged(group_name_changed),
            types::ChatEvent::GroupDescriptionChanged(group_description_changed) => {
                Self::GroupDescriptionChanged(group_description_changed)
            }
            types::ChatEvent::GroupRulesChanged(group_rules_changed) => Self::GroupRulesChanged(group_rules_changed),
            types::ChatEvent::AvatarChanged(avatar_changed) => Self::AvatarChanged(avatar_changed),
            types::ChatEvent::ParticipantsAdded(participants_added) => Self::ParticipantsAdded(participants_added),
            types::ChatEvent::ParticipantsRemoved(participants_removed) => Self::ParticipantsRemoved(participants_removed),
            types::ChatEvent::ParticipantJoined(participant_joined) => Self::ParticipantJoined(participant_joined),
            types::ChatEvent::ParticipantLeft(participant_left) => Self::ParticipantLeft(participant_left),
            types::ChatEvent::RoleChanged(role_changed) => Self::RoleChanged(role_changed),
            types::ChatEvent::UsersBlocked(users_blocked) => Self::UsersBlocked(users_blocked),
            types::ChatEvent::UsersUnblocked(users_unblocked) => Self::UsersUnblocked(users_unblocked),
            types::ChatEvent::MessagePinned(message_pinned) => Self::MessagePinned(message_pinned),
            types::ChatEvent::MessageUnpinned(message_unpinned) => Self::MessageUnpinned(message_unpinned),
            types::ChatEvent::PermissionsChanged(permissions_changed) => Self::PermissionsChanged(permissions_changed),
            types::ChatEvent::GroupVisibilityChanged(group_visibility_changed) => {
                Self::GroupVisibilityChanged(group_visibility_changed)
            }
            types::ChatEvent::GroupInviteCodeChanged(group_invite_code_changed) => {
                Self::GroupInviteCodeChanged(group_invite_code_changed)
            }
            types::ChatEvent::ChatFrozen(chat_frozen) => Self::ChatFrozen(chat_frozen),
            types::ChatEvent::ChatUnfrozen(chat_unfrozen) => Self::ChatUnfrozen(chat_unfrozen),
            types::ChatEvent::EventsTimeToLiveUpdated(events_time_to_live_updated) => {
                Self::EventsTimeToLiveUpdated(events_time_to_live_updated)
            }
            types::ChatEvent::GroupGateUpdated(group_gate_updated) => Self::GroupGateUpdated(group_gate_updated),
            types::ChatEvent::UsersInvited(users_invited) => Self::UsersInvited(users_invited),
            types::ChatEvent::MembersAddedToDefaultChannel(members_added_to_default_channel) => {
                Self::MembersAddedToDefaultChannel(members_added_to_default_channel)
            }
            types::ChatEvent::ExternalUrlUpdated(external_url_updated) => Self::ExternalUrlUpdated(external_url_updated),
            types::ChatEvent::BotAdded(bot_added) => Self::BotAdded(*bot_added),
            types::ChatEvent::BotRemoved(bot_removed) => Self::BotRemoved(*bot_removed),
            types::ChatEvent::BotUpdated(bot_updated) => Self::BotUpdated(*bot_updated),
            types::ChatEvent::FailedToDeserialize => Self::FailedToDeserialize,
        }
    }
}

impl From<types::Message> for Message {
    fn from(value: types::Message) -> Self {
        Self {
            message_index: value.message_index,
            message_id: value.message_id,
            sender: value.sender,
            content: value.content.into(),
            bot_context: value.bot_context,
            replies_to: value.replies_to,
            reactions: value.reactions,
            tips: value.tips,
            thread_summary: value.thread_summary,
            edited: value.edited,
            forwarded: value.forwarded,
            block_level_markdown: value.block_level_markdown,
        }
    }
}

impl From<types::MessageContent> for MessageContent {
    fn from(value: types::MessageContent) -> Self {
        match value {
            types::MessageContent::Text(text_content) => Self::Text(text_content),
            types::MessageContent::Image(image_content) => Self::Image(image_content),
            types::MessageContent::Video(video_content) => Self::Video(video_content),
            types::MessageContent::Audio(audio_content) => Self::Audio(audio_content),
            types::MessageContent::File(file_content) => Self::File(file_content),
            types::MessageContent::Poll(poll_content) => Self::Poll(poll_content),
            types::MessageContent::Crypto(crypto_content) => Self::Crypto(crypto_content),
            types::MessageContent::Deleted(deleted_by) => Self::Deleted(deleted_by),
            types::MessageContent::Giphy(giphy_content) => Self::Giphy(giphy_content),
            types::MessageContent::Custom(custom_content) => Self::Custom(custom_content),
            other => {
                let kind = match other {
                    types::MessageContent::GovernanceProposal(_) => "GovernanceProposal",
                    types::MessageContent::Prize(_) => "Prize",
                    types::MessageContent::PrizeWinner(_) => "PrizeWinner",
                    types::MessageContent::MessageReminderCreated(_) => "MessageReminderCreated",
                    types::MessageContent::MessageReminder(_) => "MessageReminder",
                    types::MessageContent::ReportedMessage(_) => "ReportedMessage",
                    types::MessageContent::P2PSwap(_) => "P2PSwap",
                    types::MessageContent::VideoCall(_) => "VideoCall",
                    _ => "Unknown",
                };

                Self::Unsupported(UnsupportedContent { kind: kind.to_string() })
            }
        }
    }
}
