use serde::{Deserialize, Serialize};
use types::{BotMessage, MessageContent, MessageId, MessageIndex};
use user_canister::SendMessageArgs;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub sender_message_index: MessageIndex,
    pub sender_name: String,
    pub content: MessageContent,
    pub replies_to: Option<user_canister::C2CReplyContext>,
    pub forwarding: bool,
    #[serde(default)]
    pub block_level_markdown: bool,
    #[serde(default)]
    pub correlation_id: u64,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub bot_name: String,
    #[serde(default)]
    pub bot_display_name: Option<String>,
    pub messages: Vec<BotMessage>,
}

impl Args {
    pub fn new(args: SendMessageArgs, sender_name: String) -> Args {
        Args {
            message_id: args.message_id,
            sender_message_index: args.sender_message_index,
            sender_name,
            content: args.content.hydrate(None),
            replies_to: args.replies_to,
            forwarding: args.forwarding,
            block_level_markdown: args.block_level_markdown,
            correlation_id: 0,
        }
    }
}
