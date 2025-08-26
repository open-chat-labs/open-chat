use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, MessageContent, MessageId, MessageIndex};

#[ts_export(community, deleted_message)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
}

#[ts_export(community, deleted_message)]
#[expect(clippy::large_enum_variant)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(community, deleted_message)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub content: MessageContent,
}
