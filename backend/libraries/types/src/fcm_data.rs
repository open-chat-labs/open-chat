use crate::{ChannelId, Chat, ChatId, CommunityId, MessageId, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// Values relevant for the FCM notifications
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct FcmData {
    #[serde(rename = "c")]
    pub chat_id: Chat,
    #[serde(rename = "t")]
    pub thread_id: Option<MessageId>,
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
            thread_id: None,
            body: None,
            image: None,
            sender_id: None,
            sender_name: None,
            avatar_id: None,
        }
    }

    pub fn for_direct_chat(direct_chat_id: ChatId) -> Self {
        Self::default(Chat::Direct(direct_chat_id))
    }

    pub fn for_group_chat(group_chat_id: ChatId) -> Self {
        Self::default(Chat::Group(group_chat_id))
    }

    pub fn for_community_chat(community_id: CommunityId, channel_id: ChannelId) -> Self {
        Self::default(Chat::Channel(community_id, channel_id))
    }

    pub fn set_thread_id(self, thread_id: MessageId) -> Self {
        Self {
            thread_id: Some(thread_id),
            ..self
        }
    }

    pub fn set_body(self, body: String) -> Self {
        Self {
            body: Some(body),
            ..self
        }
    }

    pub fn set_body_with_alt(self, body: &Option<String>, alt_body: &str) -> Self {
        Self {
            body: if body.is_some() { body.clone() } else { Some(alt_body.into()) },
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

    pub fn set_sender_name_with_alt(self, sender_name: &Option<String>, alt_sender_name: &str) -> Self {
        Self {
            sender_name: if sender_name.is_some() { sender_name.clone() } else { Some(alt_sender_name.into()) },
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
                map.insert("community_id".into(), community_id.to_string());
                map.insert("channel_id".into(), channel_id.to_string());
            }
            Chat::Direct(chat_id) => {
                map.insert("type".into(), "direct".into());
                map.insert("sender_id".into(), chat_id.to_string());
            }
            Chat::Group(chat_id) => {
                map.insert("type".into(), "group".into());
                map.insert("chat_id".into(), chat_id.to_string());
            }
        }

        // For group and community chats also add sender to the data! For
        // direct chats sender is already known.
        match self.chat_id {
            Chat::Direct(_) => {}
            _ => {
                if let Some(sender_id) = &self.sender_id {
                    map.insert("sender_id".into(), sender_id.to_string());
                }
            }
        }

        if let Some(thread_id) = self.thread_id {
            map.insert("thread_id".into(), thread_id.to_string());
        }

        if let Some(body) = &self.body {
            map.insert("body".into(), body.clone());
        }

        if let Some(image) = &self.image {
            map.insert("image".into(), image.clone());
        }

        if let Some(sender_name) = &self.sender_name {
            map.insert("sender_name".into(), sender_name.clone());
        }

        if let Some(avatar_id) = self.avatar_id {
            map.insert("avatar_id".into(), avatar_id.to_string());
        }

        map
    }
}
