use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{GroupReplyContext, MessageContent, MessageId, MessageIndex, User};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: MessageContent,
    pub sender_name: String,
    pub replies_to: Option<GroupReplyContext>,
    pub mentioned: Vec<User>,
    pub forwarding: bool,
    pub correlation_id: u64,
}

pub type Response = crate::send_message_v2::Response;

impl From<Args> for crate::send_message_v2::Args {
    fn from(args: Args) -> Self {
        crate::send_message_v2::Args {
            thread_root_message_index: args.thread_root_message_index,
            message_id: args.message_id,
            content: args.content.into(),
            sender_name: args.sender_name,
            replies_to: args.replies_to,
            mentioned: args.mentioned,
            forwarding: args.forwarding,
            correlation_id: args.correlation_id,
        }
    }
}
