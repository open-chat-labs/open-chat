use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageId, MessageIndex, OgPreview, UnitResult, UserId};

// Changes a message's text, or its caption, which `None` removes
#[ts_export(user, edit_message_text)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub text: Option<String>,
    pub block_level_markdown: Option<bool>,
    pub og_previews: Vec<OgPreview>,
}

pub type Response = UnitResult;
