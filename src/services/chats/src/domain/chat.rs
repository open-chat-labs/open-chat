use self::MessageContentValidationResponse::*;
use crate::domain::blob_storage::BlobStorage;
use crate::domain::direct_chat::{DirectChat, DirectChatStableState, DirectChatSummary};
use crate::domain::group_chat::{GroupChat, GroupChatStableState, GroupChatSummary};
use enum_dispatch::enum_dispatch;
use ic_cdk::export::candid::CandidType;
use serde::{Deserialize, Serialize};
use shared::chat_id::ChatId;
use shared::timestamp::Timestamp;
use shared::user_id::UserId;

#[enum_dispatch(Chat)]
pub enum ChatEnum {
    Direct(DirectChat),
    Group(GroupChat),
}

#[enum_dispatch]
pub trait Chat {
    fn get_id(&self) -> ChatId;
    fn involves_user(&self, user: &UserId) -> bool;
    fn push_message(
        &mut self,
        sender: &UserId,
        client_message_id: String,
        content: MessageContent,
        replies_to: Option<ReplyContext>,
        now: Timestamp,
    ) -> Message;
    fn get_messages(&self, user: &UserId, from_id: u32, page_size: u32) -> Vec<Message>;
    fn get_messages_by_id(&self, user: &UserId, ids: Vec<u32>) -> Vec<Message>;
    fn get_message_mut(&mut self, id: u32) -> Option<&mut Message>;
    fn get_latest_message_id(&self) -> u32;
    fn search_messages(&self, search_term: &str, user: &UserId) -> Vec<Message>;
    fn mark_read(
        &mut self,
        user: &UserId,
        from_id: u32,
        to_id: u32,
        now: Timestamp,
    ) -> MarkReadResult;
    fn mute_notifications(&mut self, user_id: UserId, mute: bool);
    fn get_unread_message_id_ranges(&self, user: &UserId) -> Vec<[u32; 2]>;
    fn get_display_date(&self, user_id: &UserId) -> Timestamp;
    fn get_updated_date(&self) -> Timestamp;
    fn to_summary(&self, user: &UserId, message_count: u32) -> ChatSummary;
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct TextContent {
    text: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct MediaContent {
    caption: Option<String>,
    mime_type: String,
    width: u32,
    height: u32,
    blob_id: String,
    blob_size: u32,
    chunk_size: u32,
    thumbnail_data: String,
    blob_deleted: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct FileContent {
    caption: Option<String>,
    name: String,
    mime_type: String,
    blob_id: String,
    blob_size: u32,
    chunk_size: u32,
    blob_deleted: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct CycleContent {
    amount: u128,
    caption: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub enum MessageContent {
    Text(TextContent),
    Media(MediaContent),
    File(FileContent),
    Cycles(CycleContent),
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub enum MessageContentType {
    Text,
    Image,
    Video,
    File,
    Cycles,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct Message {
    id: u32,
    client_message_id: String,
    timestamp: Timestamp,
    sender: UserId,
    content: MessageContent,
    replies_to: Option<ReplyContext>,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct ReplyContext {
    chat_id: ChatId,
    user_id: UserId,
    message_id: u32,
    content: MessageContent,
}

#[derive(CandidType)]
pub enum ChatSummary {
    Direct(DirectChatSummary),
    Group(GroupChatSummary),
}

#[derive(CandidType)]
pub struct MarkReadResult {
    unread_message_id_ranges: Vec<[u32; 2]>,
}

#[derive(CandidType, Deserialize)]
pub enum ChatStableState {
    Direct(DirectChatStableState),
    Group(GroupChatStableState),
}

impl ChatSummary {
    pub fn direct(self) -> Option<DirectChatSummary> {
        if let ChatSummary::Direct(d) = self {
            Some(d)
        } else {
            None
        }
    }
}

impl Message {
    pub fn new(
        id: u32,
        client_message_id: String,
        now: Timestamp,
        sender: UserId,
        content: MessageContent,
        replies_to: Option<ReplyContext>,
    ) -> Message {
        Message {
            id,
            client_message_id,
            timestamp: now,
            sender,
            content,
            replies_to,
        }
    }

    pub fn get_id(&self) -> u32 {
        self.id
    }

    pub fn get_timestamp(&self) -> Timestamp {
        self.timestamp
    }

    pub fn matches_search(&self, search_term: &str) -> bool {
        fn text_matches(text: &Option<String>, search_term: &str) -> bool {
            text.is_some() && text.as_ref().unwrap().to_lowercase().contains(search_term)
        }

        let search_term = &search_term.to_lowercase();
        match &self.content {
            MessageContent::Text(t) => t.text.to_lowercase().contains(search_term),
            MessageContent::Media(m) => text_matches(&m.caption, search_term),
            MessageContent::File(f) => {
                text_matches(&f.caption, search_term) || f.name.to_lowercase().contains(search_term)
            }
            MessageContent::Cycles(c) => text_matches(&c.caption, search_term),
        }
    }

    pub fn delete_blob_content(&mut self, blob_storage: &mut BlobStorage) {
        match &mut self.content {
            MessageContent::File(file) => {
                blob_storage.delete_blob(&file.blob_id, file.blob_size, file.chunk_size);
                file.blob_deleted = true;
            }
            MessageContent::Media(media) => {
                blob_storage.delete_blob(&media.blob_id, media.blob_size, media.chunk_size);
                media.blob_deleted = true;
            }
            _ => (),
        }
    }
}

impl MessageContent {
    pub fn is_blob(&self) -> bool {
        matches!(self, MessageContent::File(_) | MessageContent::Media(_))
    }

    pub fn validate(&self) -> MessageContentValidationResponse {
        const MAX_MESSAGE_LEN: u32 = 5000;
        const MAX_CAPTION_LEN: u32 = 500;
        const MAX_MIME_TYPE_LEN: u16 = 255;
        const MAX_BLOB_ID_LEN: u16 = 100;
        const MAX_THUMBNAIL_LEN: u16 = 5000;

        match self {
            MessageContent::Text(text) => {
                if text.text.len() > MAX_MESSAGE_LEN as usize {
                    return MessageTooLong(MAX_MESSAGE_LEN);
                }
            }
            MessageContent::Media(media) => {
                if media.mime_type.len() > MAX_MIME_TYPE_LEN as usize
                    || media.blob_id.len() > MAX_BLOB_ID_LEN as usize
                    || media.thumbnail_data.len() > MAX_THUMBNAIL_LEN as usize
                {
                    return Invalid;
                }
                if let Some(caption) = &media.caption {
                    if caption.len() > MAX_CAPTION_LEN as usize {
                        return MessageTooLong(MAX_CAPTION_LEN);
                    }
                }
            }
            MessageContent::File(file) => {
                if file.mime_type.len() > MAX_MIME_TYPE_LEN as usize
                    || file.blob_id.len() > MAX_BLOB_ID_LEN as usize
                {
                    return Invalid;
                }
                if let Some(caption) = &file.caption {
                    if caption.len() > MAX_CAPTION_LEN as usize {
                        return MessageTooLong(MAX_CAPTION_LEN);
                    }
                }
            }
            MessageContent::Cycles(cycles) => {
                if let Some(caption) = &cycles.caption {
                    if caption.len() > MAX_CAPTION_LEN as usize {
                        return MessageTooLong(MAX_CAPTION_LEN);
                    }
                }
            }
        };

        Valid
    }

    pub fn get_type(&self) -> MessageContentType {
        match self {
            MessageContent::Text(_) => MessageContentType::Text,
            MessageContent::Media(m) => {
                if m.mime_type.to_lowercase().starts_with("video/") {
                    MessageContentType::Video
                } else {
                    MessageContentType::Image
                }
            }
            MessageContent::File(_) => MessageContentType::File,
            MessageContent::Cycles(_) => MessageContentType::Cycles,
        }
    }
}

pub enum MessageContentValidationResponse {
    Valid,
    MessageTooLong(u32),
    Invalid,
}

impl MarkReadResult {
    pub fn new(unread_message_id_ranges: Vec<[u32; 2]>) -> MarkReadResult {
        MarkReadResult {
            unread_message_id_ranges,
        }
    }
}

impl ChatStableState {
    pub fn get_id(&self) -> ChatId {
        match self {
            ChatStableState::Direct(c) => c.get_id(),
            ChatStableState::Group(c) => c.get_id(),
        }
    }
}

impl From<ChatStableState> for ChatEnum {
    fn from(chat: ChatStableState) -> Self {
        match chat {
            ChatStableState::Direct(c) => ChatEnum::Direct(c.into()),
            ChatStableState::Group(c) => ChatEnum::Group(c.into()),
        }
    }
}

impl From<ChatEnum> for ChatStableState {
    fn from(chat: ChatEnum) -> Self {
        match chat {
            ChatEnum::Direct(c) => ChatStableState::Direct(c.into()),
            ChatEnum::Group(c) => ChatStableState::Group(c.into()),
        }
    }
}

impl CycleContent {
    pub fn get_amount(&self) -> u128 {
        self.amount
    }
}

impl ReplyContext {
    pub fn get_content(&self) -> &MessageContent {
        &self.content
    }
}
