use serde::{Deserialize, Serialize};
use types::{BotMessage, MessageContent, MessageId, MessageIndex};
use user_canister::c2c_send_messages::SendMessageArgs;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub sender_message_index: MessageIndex,
    pub sender_name: String,
    pub content: MessageContent,
    pub replies_to: Option<user_canister::c2c_send_messages::C2CReplyContext>,
    pub forwarding: bool,
    pub correlation_id: u64,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub bot_name: String,
    pub messages: Vec<BotMessage>,
}

impl Args {
    pub fn new(args: SendMessageArgs, sender_name: String) -> Args {
        Args {
            message_id: args.message_id,
            sender_message_index: args.sender_message_index,
            sender_name,
            content: args.content,
            replies_to: args.replies_to,
            forwarding: args.forwarding,
            correlation_id: args.correlation_id,
        }
    }
}
