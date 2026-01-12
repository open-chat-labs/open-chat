use crate::chat_events::EventsSelectionCriteria;
use candid::{CandidType, Deserialize};
use oc_error_codes::OCError;
use serde::Serialize;
use ts_export::ts_export;
use types::{
    AudioContent, BotChatContext, ChatEvent, CryptoContent, CustomContent, DeletedBy, EventIndex, EventWrapper, FileContent,
    GiphyContent, ImageContent, MessageId, MessageIndex, PollContent, Reaction, ReplyContext, SenderContext, TextContent,
    ThreadSummary, TimestampMillis, Tips, UserId, VideoContent,
};

#[ts_export(local_user_index, bot_chat_events)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_context: BotChatContext,
    pub thread: Option<MessageIndex>,
    pub events: EventsSelectionCriteria,
}

#[ts_export(local_user_index, bot_chat_events)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(EventsResponse),
    Error(OCError),
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
pub struct Message {
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sender: UserId,
    pub content: MessageContent,
    pub sender_context: Option<SenderContext>,
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
            events: value.events,
            unauthorized: value.unauthorized,
            expired_event_ranges: value.expired_event_ranges,
            expired_message_ranges: value.expired_message_ranges,
            latest_event_index: value.latest_event_index,
            chat_last_updated: value.chat_last_updated,
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
            sender_context: value.sender_context,
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
            other => Self::Unsupported(UnsupportedContent {
                kind: other.content_type().to_string(),
            }),
        }
    }
}
