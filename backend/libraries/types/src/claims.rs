use crate::{Chat, UserId};
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
pub struct VideoCallClaims {
    pub user_id: UserId,
    pub chat_id: StringChat,
}
