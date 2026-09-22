use chat_events::MessageContentInternal;
use serde::{Deserialize, Serialize};
use types::{ChannelId, GroupReplyContext, MessageId, MessageIndex, OgPreview, User, UserId, Version};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: MessageContentInternal,
    pub sender_name: String,
    pub sender_display_name: Option<String>,
    pub replies_to: Option<GroupReplyContext>,
    pub mentioned: Vec<User>,
    pub forwarding: bool,
    pub block_level_markdown: bool,
    #[serde(default)]
    pub og_previews: Vec<OgPreview>,
    // Set by a MultiUser canister to say which of its users is sending, since the caller alone
    // doesn't identify them. A User canister leaves it unset.
    #[serde(default)]
    pub sender: Option<UserId>,
    pub community_rules_accepted: Option<Version>,
    pub channel_rules_accepted: Option<Version>,
    pub message_filter_failed: Option<u64>,
}

pub type Response = crate::send_message::Response;
