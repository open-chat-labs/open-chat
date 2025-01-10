use crate::{BotCommand, CanisterId, Chat, MessageId, MessageIndex, UserId, VideoCallType};
use serde::{Deserialize, Serialize};
use std::str::FromStr;

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

impl TryFrom<&StringChat> for Chat {
    type Error = ();

    fn try_from(value: &StringChat) -> Result<Self, Self::Error> {
        match value {
            StringChat::Direct(chat_id) => CanisterId::from_text(chat_id).map(|c| Chat::Direct(c.into())).map_err(|_| ()),
            StringChat::Group(chat_id) => CanisterId::from_text(chat_id).map(|c| Chat::Group(c.into())).map_err(|_| ()),
            StringChat::Channel(community_id, channel_id) => {
                match (CanisterId::from_text(community_id), u128::from_str(channel_id)) {
                    (Ok(community_id), Ok(channel_id)) => Ok(Chat::Channel(community_id.into(), channel_id.into())),
                    _ => Err(()),
                }
            }
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
    pub chat: StringChat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub command: BotCommand,
    pub bot_api_gateway: CanisterId,
}
