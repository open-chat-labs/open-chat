use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BotChatContext, ChannelId, MessageId, MessageIndex};

// A bot asking for the token which lets the MiniApp service post one card for it, in the context it
// would send a message with: the command's token, or the chat, and, as for `bot_send_message`, the
// channel of a community command and the thread. The card's message id is a chat command's, or
// otherwise one the bot chooses, which it must give.
#[ts_export(local_user_index, bot_mini_app_post_token)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub chat_context: BotChatContext,
    pub channel_id: Option<ChannelId>,
    pub thread: Option<MessageIndex>,
    pub message_id: Option<MessageId>,
}

#[ts_export(local_user_index, bot_mini_app_post_token)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(String),
    Error(OCError),
}
