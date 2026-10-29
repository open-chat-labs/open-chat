use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BotChatContext, BotMessageContent, BridgedUser, EventIndex, MessageId, MessageIndex, OgPreview, TimestampMillis};

#[ts_export(local_user_index, bot_send_message)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub chat_context: BotChatContext,
    pub thread: Option<MessageIndex>,
    pub message_id: Option<MessageId>,
    pub replies_to: Option<EventIndex>,
    pub content: BotMessageContent,
    pub block_level_markdown: bool,
    pub finalised: bool,
    pub og_previews: Option<Vec<OgPreview>>,
    // Only the bridge bot for its platform can set this, on the messages it relays from there: the
    // author's profile on that platform. The message holds only the author's id, and the UserIndex
    // keeps the latest profile.
    pub bridged_from: Option<BridgedUser>,
}

#[ts_export(local_user_index, bot_send_message)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(local_user_index, bot_send_message)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SuccessResult {
    pub message_id: MessageId,
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
    pub expires_at: Option<TimestampMillis>,
    // For a MiniApp card, a token which registers its game with the MiniApp service
    pub mini_app_registration: Option<String>,
}
