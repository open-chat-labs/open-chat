use crate::{
    CallDismissalKind, CallFacts, ChannelId, Chat, ChatId, CommunityId, MessageId, MessageIndex, TimestampMillis, UserId,
    UserNotificationPayload, VideoCallType,
};
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
    // The message content type (e.g. "Image", "Video", "Giphy", "File", "Audio"). Lets
    // the client decide how to present the attachment (render an image inline vs. show a
    // typed "shared a …" label). None for notifications without message content.
    #[serde(rename = "ct", default)]
    pub message_type: Option<String>,
    // The attached file's name, for File messages. Shown by the client in the notification.
    #[serde(rename = "fn", default)]
    pub file_name: Option<String>,
    #[serde(rename = "i")]
    pub image: Option<String>,
    #[serde(rename = "s")]
    pub sender_id: Option<UserId>,
    #[serde(rename = "n")]
    pub sender_name: Option<String>,
    #[serde(rename = "a")]
    pub sender_avatar_id: Option<u128>,
    // Present only when the local user index has decided this call should ring the device.
    // Absent, the data is exactly what a message notification carried before native calls.
    #[serde(rename = "vc", default)]
    pub call: Option<FcmCallData>,
    // Present only for a "stop ringing" push. Such a push is never shown to the user.
    #[serde(rename = "cd", default)]
    pub call_dismissal: Option<FcmCallDismissal>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug)]
pub struct FcmCallData {
    #[serde(rename = "id")]
    pub message_id: MessageId,
    #[serde(rename = "ct")]
    pub call_type: VideoCallType,
    #[serde(rename = "ao")]
    pub audio_only: bool,
    #[serde(rename = "st")]
    pub started: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug)]
pub struct FcmCallDismissal {
    #[serde(rename = "id")]
    pub message_id: MessageId,
    #[serde(rename = "k")]
    pub kind: CallDismissalKind,
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
            message_type: None,
            file_name: None,
            image: None,
            sender_id: None,
            sender_name: None,
            sender_avatar_id: None,
            call: None,
            call_dismissal: None,
        }
    }

    // The data for a push that tells a device to stop ringing for one call. It carries no
    // `senderId` on purpose: the Android shell's decoder treats any unknown `type` that has a
    // `senderId` as a direct message and would show it.
    pub fn call_dismissal(chat: Chat, message_id: MessageId, kind: CallDismissalKind) -> Self {
        Self {
            call_dismissal: Some(FcmCallDismissal { message_id, kind }),
            ..Self::default(chat)
        }
    }

    pub fn is_call_dismissal(&self) -> bool {
        self.call_dismissal.is_some()
    }

    // Marks the push as one that should ring the device for this call
    pub fn set_call(self, facts: &CallFacts) -> Self {
        Self {
            call: Some(FcmCallData {
                message_id: facts.message_id,
                call_type: facts.call_type,
                audio_only: facts.audio_only,
                started: facts.started,
            }),
            ..self
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

    pub fn set_message_type(self, message_type: String) -> Self {
        Self {
            message_type: Some(message_type),
            ..self
        }
    }

    pub fn set_file_name(self, file_name: Option<String>) -> Self {
        Self { file_name, ..self }
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

        if let Some(dismissal) = self.call_dismissal {
            add_to_map("type", Some("call_dismissed".into()));
            match self.chat_id {
                Chat::Direct(user_id) => {
                    add_to_map("chatType", Some("direct".into()));
                    add_to_map("chatId", Some(user_id.to_string()));
                }
                Chat::Group(group_id) => {
                    add_to_map("chatType", Some("group".into()));
                    add_to_map("chatId", Some(group_id.to_string()));
                }
                Chat::Channel(community_id, channel_id) => {
                    add_to_map("chatType", Some("channel".into()));
                    add_to_map("communityId", Some(community_id.to_string()));
                    add_to_map("chatId", Some(channel_id.to_string()));
                }
            }
            add_to_map("callMessageId", Some(dismissal.message_id.to_string()));
            add_to_map(
                "dismissalKind",
                Some(
                    match dismissal.kind {
                        CallDismissalKind::Ended => "ended",
                        CallDismissalKind::AnsweredElsewhere => "answered_elsewhere",
                    }
                    .into(),
                ),
            );
            return map;
        }

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
        add_to_map("messageType", self.message_type);
        add_to_map("fileName", self.file_name);
        add_to_map("body", self.body);
        if let Some(call) = self.call {
            add_to_map("callMessageId", Some(call.message_id.to_string()));
            add_to_map(
                "callType",
                Some(
                    match call.call_type {
                        VideoCallType::Default => "default",
                        VideoCallType::Broadcast => "broadcast",
                    }
                    .into(),
                ),
            );
            add_to_map("callAudioOnly", Some(call.audio_only.to_string()));
            add_to_map("callStarted", Some(call.started.to_string()));
        }
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
                .set_message_type(n.message_type)
                .set_file_name(n.file_name)
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
                .set_message_type(n.message_type)
                .set_file_name(n.file_name)
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
                .set_message_type(n.message_type)
                .set_file_name(n.file_name)
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

            // Dismissals. The local user index only lets these through when the call rang.
            UserNotificationPayload::DirectCallDismissed(n) => {
                FcmData::call_dismissal(Chat::Direct(n.them.into()), n.message_id, n.kind)
            }
            UserNotificationPayload::GroupCallDismissed(n) => {
                FcmData::call_dismissal(Chat::Group(n.chat_id), n.message_id, n.kind)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{DirectMessageNotification, EventIndex};
    use candid::Principal;

    fn user(n: u8) -> UserId {
        Principal::from_slice(&[n]).into()
    }

    fn facts() -> CallFacts {
        CallFacts {
            message_id: 7u64.into(),
            call_type: VideoCallType::Default,
            audio_only: true,
            started: 1000,
            is_public: false,
            member_count: 2,
        }
    }

    fn direct_message(call: Option<CallFacts>) -> UserNotificationPayload {
        UserNotificationPayload::DirectMessage(DirectMessageNotification {
            sender: user(1),
            thread_root_message_index: None,
            message_index: 3.into(),
            event_index: EventIndex::from(4),
            sender_name: "a".to_string(),
            sender_display_name: None,
            message_type: "VideoCall".to_string(),
            message_text: None,
            image_url: None,
            file_name: None,
            sender_avatar_id: None,
            crypto_transfer: None,
            call,
        })
    }

    // #9456 invariants 1 and 3, the mapping half: the facts a canister sends never reach the
    // device by themselves. Only the local user index, having decided the call rings, adds the
    // call fields. So a call start that does not ring maps to exactly what it mapped to before.
    #[test]
    fn invariants_1_and_3_call_facts_alone_change_nothing_in_the_fcm_data() {
        let with = FcmData::from(direct_message(Some(facts()))).as_data();
        let without = FcmData::from(direct_message(None)).as_data();
        assert_eq!(with, without);
        assert!(!with.contains_key("callMessageId"));
    }

    // #9456 invariant 9: when the call rings, the device is told which call
    #[test]
    fn invariant_9_a_ringing_push_names_the_call() {
        let data = FcmData::from(direct_message(Some(facts()))).set_call(&facts()).as_data();
        assert_eq!(data["callMessageId"], "7");
        assert_eq!(data["callType"], "default");
        assert_eq!(data["callAudioOnly"], "true");
        assert_eq!(data["callStarted"], "1000");
        // and it is still a direct message notification underneath
        assert_eq!(data["type"], "direct");
        assert_eq!(data["senderId"], user(1).to_string());
    }

    // #9456 invariant 7: a dismissal's data has a type the field decoder does not know and no
    // senderId, because that decoder treats any unknown type with a senderId as a direct
    // message and would show it (NotificationDecoder.kt:85)
    #[test]
    fn invariant_7_a_dismissal_is_unknown_to_the_field_decoder() {
        for (chat, chat_type) in [
            (Chat::Direct(user(1).into()), "direct"),
            (Chat::Group(user(2).into()), "group"),
        ] {
            let data = FcmData::call_dismissal(chat, 7u64.into(), CallDismissalKind::AnsweredElsewhere).as_data();
            assert_eq!(data["type"], "call_dismissed");
            assert!(!data.contains_key("senderId"), "{data:?}");
            assert_eq!(data["chatType"], chat_type);
            assert_eq!(data["callMessageId"], "7");
            assert_eq!(data["dismissalKind"], "answered_elsewhere");
        }
    }
}
