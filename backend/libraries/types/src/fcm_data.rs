use crate::{ChannelId, Chat, ChatId, CommunityId, MessageIndex, UserId, UserNotificationPayload};
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

impl From<UserNotificationPayload> for FcmData {
    fn from(value: UserNotificationPayload) -> Self {
        match value {
            UserNotificationPayload::AddedToChannel(n) => FcmData::for_channel(n.community_id, n.channel_id)
                .set_sender_id(n.added_by)
                .set_sender_name_with_alt(n.added_by_display_name, n.added_by_name)
                .set_body(format!("Added you to the channel '{}'", n.channel_name))
                .set_avatar_id(n.channel_avatar_id.or(n.community_avatar_id)),
            UserNotificationPayload::DirectMessage(n) => FcmData::for_direct_chat(n.sender)
                .set_sender_name_with_alt(n.sender_display_name, n.sender_name)
                .set_optional_thread(n.thread_root_message_index)
                .set_body_with_alt(n.message_text, n.message_type)
                .set_optional_image(n.image_url)
                .set_avatar_id(n.sender_avatar_id),
            UserNotificationPayload::GroupMessage(n) => FcmData::for_group(n.chat_id)
                .set_sender_id(n.sender)
                .set_sender_name_with_alt(n.sender_display_name, n.sender_name)
                .set_optional_thread(n.thread_root_message_index)
                .set_body_with_alt(n.message_text, n.message_type)
                .set_optional_image(n.image_url)
                .set_avatar_id(n.group_avatar_id),
            UserNotificationPayload::ChannelMessage(n) => FcmData::for_channel(n.community_id, n.channel_id)
                .set_sender_id(n.sender)
                .set_sender_name_with_alt(n.sender_display_name, n.sender_name)
                .set_optional_thread(n.thread_root_message_index)
                .set_body_with_alt(n.message_text, n.message_type)
                .set_optional_image(n.image_url)
                .set_avatar_id(n.channel_avatar_id.or(n.community_avatar_id)),
            UserNotificationPayload::DirectReactionAdded(n) => FcmData::for_direct_chat(n.them)
                .set_sender_name_with_alt(n.display_name, n.username)
                .set_optional_thread(n.thread_root_message_index)
                .set_body(format!("Reacted {} to your message", n.reaction.0))
                .set_avatar_id(n.user_avatar_id),
            UserNotificationPayload::GroupReactionAdded(n) => FcmData::for_group(n.chat_id)
                .set_sender_id(n.added_by)
                .set_sender_name_with_alt(n.added_by_display_name, n.added_by_name)
                .set_optional_thread(n.thread_root_message_index)
                .set_body(format!("Reacted {} to your message", n.reaction.0))
                .set_avatar_id(n.group_avatar_id),
            UserNotificationPayload::ChannelReactionAdded(n) => FcmData::for_channel(n.community_id, n.channel_id)
                .set_sender_id(n.added_by)
                .set_sender_name_with_alt(n.added_by_display_name, n.added_by_name)
                .set_optional_thread(n.thread_root_message_index)
                .set_body(format!("Reacted {} to your message", n.reaction.0))
                .set_avatar_id(n.channel_avatar_id.or(n.community_avatar_id)),
            UserNotificationPayload::DirectMessageTipped(n) => FcmData::for_direct_chat(n.them)
                .set_sender_name_with_alt(n.display_name, n.username)
                .set_optional_thread(n.thread_root_message_index)
                .set_body(format!("Tipped your message {}", n.tip))
                .set_avatar_id(n.user_avatar_id),
            UserNotificationPayload::GroupMessageTipped(n) => FcmData::for_group(n.chat_id)
                .set_sender_id(n.tipped_by)
                .set_sender_name_with_alt(n.tipped_by_display_name, n.tipped_by_name)
                .set_optional_thread(n.thread_root_message_index)
                .set_body(format!("Tipped your message {}", n.tip))
                .set_avatar_id(n.group_avatar_id),
            UserNotificationPayload::ChannelMessageTipped(n) => FcmData::for_channel(n.community_id, n.channel_id)
                .set_sender_id(n.tipped_by)
                .set_sender_name_with_alt(n.tipped_by_display_name, n.tipped_by_name)
                .set_optional_thread(n.thread_root_message_index)
                .set_body(format!("Tipped your message {}", n.tip))
                .set_avatar_id(n.channel_avatar_id.or(n.community_avatar_id)),
        }
    }
}
