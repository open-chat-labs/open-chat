use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageId, MessageIndex, UnitResult};

#[ts_export(group, report_message)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub delete: bool,
}

pub type Response = UnitResult;
