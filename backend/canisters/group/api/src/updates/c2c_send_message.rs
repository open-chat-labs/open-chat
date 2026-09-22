use chat_events::MessageContentInternal;
use serde::{Deserialize, Serialize};
use types::{GroupReplyContext, MessageId, MessageIndex, OgPreview, User, UserId, Version};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: MessageContentInternal,
    pub sender_name: String,
    pub sender_display_name: Option<String>,
    pub replies_to: Option<GroupReplyContext>,
    pub mentioned: Vec<User>,
    pub forwarding: bool,
    pub block_level_markdown: bool,
    pub rules_accepted: Option<Version>,
    pub message_filter_failed: Option<u64>,
    #[serde(default)]
    pub og_previews: Vec<OgPreview>,
    // The user being acted for when the caller holds many users, which must be one of its users
    #[serde(default)]
    pub user_id: Option<UserId>,
}

pub type Response = crate::send_message_v2::Response;

#[cfg(test)]
mod tests {
    use super::*;
    use chat_events::TextContentInternal;

    #[test]
    fn deserializes_from_the_previous_args() {
        #[derive(Serialize)]
        struct PreviousArgs {
            thread_root_message_index: Option<MessageIndex>,
            message_id: MessageId,
            content: MessageContentInternal,
            sender_name: String,
            sender_display_name: Option<String>,
            replies_to: Option<GroupReplyContext>,
            mentioned: Vec<User>,
            forwarding: bool,
            block_level_markdown: bool,
            rules_accepted: Option<Version>,
            message_filter_failed: Option<u64>,
            og_previews: Vec<OgPreview>,
        }

        let args: Args = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(PreviousArgs {
            thread_root_message_index: None,
            message_id: 1u64.into(),
            content: MessageContentInternal::Text(TextContentInternal {
                text: "hello".to_string(),
            }),
            sender_name: "sender".to_string(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            forwarding: false,
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            og_previews: Vec::new(),
        }));
        assert_eq!(args.message_id, 1u64.into());
        assert_eq!(args.sender_name, "sender");
        assert!(args.user_id.is_none());
    }
}
