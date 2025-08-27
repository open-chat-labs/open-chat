use crate::{ChannelId, Chat, ChatId, CommunityId, MessageIndex, UserId, UserNotificationPayload};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(CandidType, Serialize, Deserialize, Clone, Default, Debug)]
pub enum BodyType {
    #[default]
    Message,
    Reaction,
    Tip,
    Invite,
}

// Values relevant for the FCM notifications
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct FcmData {
    #[serde(rename = "c")]
    pub chat_id: Chat,
    #[serde(rename = "gn", default)]
    pub group_name: Option<String>,
    #[serde(rename = "ga", default)]
    pub group_avatar_id: Option<u128>,
    #[serde(rename = "cn", default)]
    pub community_name: Option<String>,
    #[serde(rename = "hn", default)]
    pub channel_name: Option<String>,
    #[serde(rename = "ca", default)]
    pub channel_avatar_id: Option<u128>,
    #[serde(rename = "ha", default)]
    pub community_avatar_id: Option<u128>,
    #[serde(rename = "t")]
    pub thread_root_message_index: Option<MessageIndex>,
    #[serde(rename = "b")]
    pub body: Option<String>,
    #[serde(rename = "mt", default)]
    pub body_type: BodyType,
    #[serde(rename = "i")]
    pub image: Option<String>,
    #[serde(rename = "s")]
    pub sender_id: Option<UserId>,
    #[serde(rename = "n")]
    pub sender_name: Option<String>,
    #[serde(rename = "a")]
    pub sender_avatar_id: Option<u128>,
}

impl FcmData {
    fn default(chat_id: Chat) -> Self {
        Self {
            chat_id,
            group_name: None,
            group_avatar_id: None,
            community_name: None,
            channel_name: None,
            channel_avatar_id: None,
            community_avatar_id: None,
            thread_root_message_index: None,
            body: None,
            body_type: BodyType::Message,
            image: None,
            sender_id: None,
            sender_name: None,
            sender_avatar_id: None,
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

    pub fn set_group_name(self, group_name: String) -> Self {
        Self {
            group_name: Some(group_name),
            ..self
        }
    }

    pub fn set_group_avatar_id(self, group_avatar_id: Option<u128>) -> Self {
        Self { group_avatar_id, ..self }
    }

    pub fn for_channel(community_id: CommunityId, channel_id: ChannelId) -> Self {
        Self::default(Chat::Channel(community_id, channel_id))
    }

    pub fn set_community_name(self, community_name: String) -> Self {
        Self {
            community_name: Some(community_name),
            ..self
        }
    }

    pub fn set_channel_name(self, channel_name: String) -> Self {
        Self {
            channel_name: Some(channel_name),
            ..self
        }
    }

    pub fn set_channel_avatar_id(self, channel_avatar_id: Option<u128>) -> Self {
        Self {
            channel_avatar_id,
            ..self
        }
    }

    pub fn set_community_avatar_id(self, community_avatar_id: Option<u128>) -> Self {
        Self {
            community_avatar_id,
            ..self
        }
    }

    pub fn set_thread(self, thread_root_message_index: Option<MessageIndex>) -> Self {
        Self {
            thread_root_message_index,
            ..self
        }
    }

    pub fn set_message(self, message: Option<String>) -> Self {
        Self { body: message, ..self }
    }

    pub fn set_reaction(self, reaction: String) -> Self {
        Self {
            body: Some(reaction),
            body_type: BodyType::Reaction,
            ..self
        }
    }

    pub fn set_tip(self, tip: String) -> Self {
        Self {
            body: Some(tip),
            body_type: BodyType::Tip,
            ..self
        }
    }

    pub fn set_invite(self) -> Self {
        Self {
            body_type: BodyType::Invite,
            ..self
        }
    }

    pub fn set_image(self, image: Option<String>) -> Self {
        Self { image, ..self }
    }

    pub fn set_sender_id(self, sender_id: UserId) -> Self {
        Self {
            sender_id: Some(sender_id),
            ..self
        }
    }

    pub fn set_sender_name(self, display_name: Option<String>, name: String) -> Self {
        Self {
            sender_name: display_name.or(Some(name)),
            ..self
        }
    }

    pub fn set_sender_avatar_id(self, sender_avatar_id: Option<u128>) -> Self {
        Self {
            sender_avatar_id,
            ..self
        }
    }

    pub fn as_data(self) -> HashMap<String, String> {
        let mut map = HashMap::new();
        let mut add_to_map = |key: &str, value: Option<String>| {
            if let Some(value) = value {
                map.insert(key.into(), value);
            }
        };

        match self.chat_id {
            Chat::Direct(sender_id) => {
                add_to_map("type", Some("direct".into()));
                // This may be redundant, but it helps to ensure the sender_id is always present
                add_to_map("senderId", Some(sender_id.to_string()));
            }
            Chat::Group(group_id) => {
                add_to_map("type", Some("group".into()));
                add_to_map("groupId", Some(group_id.to_string()));
            }
            Chat::Channel(community_id, channel_id) => {
                add_to_map("type", Some("channel".into()));
                add_to_map("channelId", Some(channel_id.to_string()));
                add_to_map("communityId", Some(community_id.to_string()));
            }
        }

        add_to_map("groupName", self.group_name);
        add_to_map("groupAvatarId", self.group_avatar_id.map(|v| v.to_string()));
        add_to_map("communityName", self.community_name);
        add_to_map("channelName", self.channel_name);
        add_to_map("channelAvatarId", self.channel_avatar_id.map(|v| v.to_string()));
        add_to_map("communityAvatarId", self.community_avatar_id.map(|v| v.to_string()));

        add_to_map("senderId", self.sender_id.map(|v| v.to_string()));
        add_to_map("senderName", self.sender_name);
        add_to_map("senderAvatarId", self.sender_avatar_id.map(|v| v.to_string()));

        add_to_map("threadIndex", self.thread_root_message_index.map(|t| t.to_string()));
        add_to_map("image", self.image);
        add_to_map("body", self.body);
        add_to_map(
            "bodyType",
            Some(
                match self.body_type {
                    BodyType::Message => "message",
                    BodyType::Reaction => "reaction",
                    BodyType::Tip => "tip",
                    BodyType::Invite => "invite",
                }
                .into(),
            ),
        );

        map
    }
}

impl From<UserNotificationPayload> for FcmData {
    fn from(value: UserNotificationPayload) -> Self {
        match value {
            // Direct Notifications
            UserNotificationPayload::DirectMessage(n) => FcmData::for_direct_chat(n.sender)
                .set_sender_name(n.sender_display_name, n.sender_name)
                .set_sender_avatar_id(n.sender_avatar_id)
                .set_thread(n.thread_root_message_index)
                .set_message(n.message_text)
                .set_image(n.image_url),
            UserNotificationPayload::DirectReactionAdded(n) => FcmData::for_direct_chat(n.them)
                .set_sender_name(n.display_name, n.username)
                .set_sender_avatar_id(n.user_avatar_id)
                .set_thread(n.thread_root_message_index)
                .set_reaction(n.reaction.0),
            UserNotificationPayload::DirectMessageTipped(n) => FcmData::for_direct_chat(n.them)
                .set_sender_name(n.display_name, n.username)
                .set_sender_avatar_id(n.user_avatar_id)
                .set_thread(n.thread_root_message_index)
                .set_tip(n.tip),

            // Group notifications
            UserNotificationPayload::GroupMessage(n) => FcmData::for_group(n.chat_id)
                .set_group_name(n.group_name)
                .set_group_avatar_id(n.group_avatar_id)
                .set_sender_id(n.sender)
                .set_sender_name(n.sender_display_name, n.sender_name)
                .set_sender_avatar_id(n.group_avatar_id)
                .set_thread(n.thread_root_message_index)
                .set_message(n.message_text)
                .set_image(n.image_url),
            UserNotificationPayload::GroupReactionAdded(n) => FcmData::for_group(n.chat_id)
                .set_group_name(n.group_name)
                .set_group_avatar_id(n.group_avatar_id)
                .set_sender_id(n.added_by)
                .set_sender_name(n.added_by_display_name, n.added_by_name)
                .set_thread(n.thread_root_message_index)
                .set_reaction(n.reaction.0),
            UserNotificationPayload::GroupMessageTipped(n) => FcmData::for_group(n.chat_id)
                .set_group_name(n.group_name)
                .set_group_avatar_id(n.group_avatar_id)
                .set_sender_id(n.tipped_by)
                .set_sender_name(n.tipped_by_display_name, n.tipped_by_name)
                .set_thread(n.thread_root_message_index)
                .set_tip(n.tip),

            // Community / channel notifications
            UserNotificationPayload::ChannelMessage(n) => FcmData::for_channel(n.community_id, n.channel_id)
                .set_community_name(n.community_name)
                .set_channel_name(n.channel_name)
                .set_channel_avatar_id(n.channel_avatar_id)
                .set_community_avatar_id(n.community_avatar_id)
                .set_sender_id(n.sender)
                .set_sender_name(n.sender_display_name, n.sender_name)
                .set_thread(n.thread_root_message_index)
                .set_message(n.message_text)
                .set_image(n.image_url),
            UserNotificationPayload::AddedToChannel(n) => FcmData::for_channel(n.community_id, n.channel_id)
                .set_community_name(n.community_name)
                .set_channel_name(n.channel_name)
                .set_channel_avatar_id(n.channel_avatar_id)
                .set_community_avatar_id(n.community_avatar_id)
                .set_sender_id(n.added_by)
                .set_sender_name(n.added_by_display_name, n.added_by_name)
                .set_invite(),
            UserNotificationPayload::ChannelReactionAdded(n) => FcmData::for_channel(n.community_id, n.channel_id)
                .set_community_name(n.community_name)
                .set_channel_name(n.channel_name)
                .set_channel_avatar_id(n.channel_avatar_id)
                .set_community_avatar_id(n.community_avatar_id)
                .set_sender_id(n.added_by)
                .set_sender_name(n.added_by_display_name, n.added_by_name)
                .set_thread(n.thread_root_message_index)
                .set_reaction(n.reaction.0),
            UserNotificationPayload::ChannelMessageTipped(n) => FcmData::for_channel(n.community_id, n.channel_id)
                .set_community_name(n.community_name)
                .set_channel_name(n.channel_name)
                .set_channel_avatar_id(n.channel_avatar_id)
                .set_community_avatar_id(n.community_avatar_id)
                .set_sender_id(n.tipped_by)
                .set_sender_name(n.tipped_by_display_name, n.tipped_by_name)
                .set_thread(n.thread_root_message_index)
                .set_tip(n.tip),
        }
    }
}
