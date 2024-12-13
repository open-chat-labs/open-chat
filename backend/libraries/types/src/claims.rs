use crate::{CanisterId, Chat, MessageId, MessageIndex, UserId, VideoCallType};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub enum StringChat {
    Direct(String),
    Group(String),
    Channel(String, String),
}

impl From<Chat> for StringChat {
    fn from(value: Chat) -> Self {
        match value {
            Chat::Direct(chat_id) => StringChat::Direct(chat_id.to_string()),
            Chat::Group(chat_id) => StringChat::Group(chat_id.to_string()),
            Chat::Channel(community_id, channel_id) => StringChat::Channel(community_id.to_string(), channel_id.to_string()),
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct JoinOrEndVideoCallClaims {
    pub user_id: UserId,
    pub chat_id: StringChat,
}

#[derive(Serialize, Deserialize)]
pub struct StartVideoCallClaims {
    pub user_id: UserId,
    pub chat_id: StringChat,
    pub call_type: VideoCallType,
    pub is_diamond: bool,
}

#[derive(Serialize, Deserialize)]
pub struct BotCommandClaims {
    pub initiator: UserId,
    pub bot: UserId,
    pub chat: Chat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub command_name: String,
    pub parameters: String,
    pub version: u32,
    pub command_text: String,
    pub bot_api_gateway: CanisterId,
}
