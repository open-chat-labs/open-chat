use crate::{ChannelId, Chat, ChatId, CommunityId, MessageIndex, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// Values relevant for the FCM notifications
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct FcmData {
    #[serde(rename = "c")]
    pub chat_id: Chat,
    #[serde(rename = "t")]
    pub thread_root_message_index: Option<MessageIndex>,
    #[serde(rename = "b")]
    pub body: Option<String>,
    #[serde(rename = "i")]
    pub image: Option<String>,
    #[serde(rename = "s")]
    pub sender_id: Option<UserId>,
    #[serde(rename = "n")]
    pub sender_name: Option<String>,
    #[serde(rename = "a")]
    pub avatar_id: Option<u128>,
}

impl FcmData {
    fn default(chat_id: Chat) -> Self {
        Self {
            chat_id,
            thread_root_message_index: None,
            body: None,
            image: None,
            sender_id: None,
            sender_name: None,
            avatar_id: None,
        }
    }

    pub fn for_direct_chat(direct_chat_id: UserId) -> Self {
        Self {
            sender_id: Some(direct_chat_id),
            ..Self::default(Chat::Direct(direct_chat_id.into()))
        }
    }

    pub fn for_group(group_chat_id: ChatId) -> Self {
        Self::default(Chat::Group(group_chat_id))
    }

    pub fn for_channel(community_id: CommunityId, channel_id: ChannelId) -> Self {
        Self::default(Chat::Channel(community_id, channel_id))
    }

    pub fn set_thread(self, thread_root_message_index: MessageIndex) -> Self {
        Self {
            thread_root_message_index: Some(thread_root_message_index),
            ..self
        }
    }

    pub fn set_optional_thread(self, thread_root_message_index: Option<MessageIndex>) -> Self {
        Self {
            thread_root_message_index,
            ..self
        }
    }

    pub fn set_body(self, body: String) -> Self {
        Self {
            body: Some(body),
            ..self
        }
    }

    pub fn set_body_with_alt(self, body: Option<String>, alt_body: String) -> Self {
        Self {
            body: Some(body.unwrap_or(alt_body)),
            ..self
        }
    }

    pub fn set_optional_image(self, image: Option<String>) -> Self {
        Self { image, ..self }
    }

    pub fn set_sender_id(self, sender_id: UserId) -> Self {
        Self {
            sender_id: Some(sender_id),
            ..self
        }
    }

    pub fn set_sender_name(self, sender_name: String) -> Self {
        Self {
            sender_name: Some(sender_name),
            ..self
        }
    }

    pub fn set_sender_name_with_alt(self, sender_name: Option<String>, alt_sender_name: String) -> Self {
        Self {
            sender_name: Some(sender_name.unwrap_or(alt_sender_name)),
            ..self
        }
    }

    pub fn set_avatar_id(self, avatar_id: Option<u128>) -> Self {
        Self { avatar_id, ..self }
    }

    pub fn as_data(&self) -> HashMap<String, String> {
        let mut map = HashMap::new();

        match self.chat_id {
            Chat::Channel(community_id, channel_id) => {
                map.insert("type".into(), "community".into());
                map.insert("communityId".into(), community_id.to_string());
                map.insert("channelId".into(), channel_id.to_string());
            }
            // Sender id is already initialised with the same value, so we
            // ignore it here (only for direct chats).
            Chat::Direct(_) => {
                map.insert("type".into(), "direct".into());
            }
            Chat::Group(chat_id) => {
                map.insert("type".into(), "group".into());
                map.insert("chatId".into(), chat_id.to_string());
            }
        }

        if let Some(thread) = self.thread_root_message_index {
            map.insert("thread".into(), thread.to_string());
        }

        if let Some(body) = &self.body {
            map.insert("body".into(), body.clone());
        }

        if let Some(image) = &self.image {
            map.insert("image".into(), image.clone());
        }

        // Initialised by default for direct chats, while can be set for
        // group and community chats.
        if let Some(sender_id) = &self.sender_id {
            map.insert("senderId".into(), sender_id.to_string());
        }

        if let Some(sender_name) = &self.sender_name {
            map.insert("senderName".into(), sender_name.clone());
        }

        if let Some(avatar_id) = self.avatar_id {
            map.insert("avatarId".into(), avatar_id.to_string());
        }

        map
    }
}
