use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageContent, MessageId, MessageIndex};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: MessageContent,
    pub correlation_id: u64,
}

pub type Response = crate::edit_message_v2::Response;

impl From<Args> for crate::edit_message_v2::Args {
    fn from(args: Args) -> Self {
        crate::edit_message_v2::Args {
            thread_root_message_index: args.thread_root_message_index,
            message_id: args.message_id,
            content: args.content.into(),
            correlation_id: args.correlation_id,
        }
    }
}
