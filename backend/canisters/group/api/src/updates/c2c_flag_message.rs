use serde::{Deserialize, Serialize};
use types::{MessageId, MessageIndex, UnitResult};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub flags: u32,
}

pub type Response = UnitResult;
