use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatId, CryptoContent, GroupReplyContext, MessageId, MessageIndex, User, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub group_id: ChatId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub recipient: UserId,
    pub content: CryptoContent,
    pub sender_name: String,
    pub replies_to: Option<GroupReplyContext>,
    pub mentioned: Vec<User>,
    pub correlation_id: u64,
}

pub type Response = crate::send_message_with_transfer_to_group::Response;

impl From<Args> for crate::send_message_with_transfer_to_group::Args {
    fn from(args: Args) -> Self {
        crate::send_message_with_transfer_to_group::Args {
            group_id: args.group_id,
            thread_root_message_index: args.thread_root_message_index,
            message_id: args.message_id,
            content: types::MessageContentInitial::Crypto(args.content),
            sender_name: args.sender_name,
            replies_to: args.replies_to,
            mentioned: args.mentioned,
            correlation_id: args.correlation_id,
        }
    }
}
