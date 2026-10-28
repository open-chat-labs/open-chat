use serde::{Deserialize, Serialize};
use types::{MessageId, MessageIndex, MiniAppStatusUpdate, UnitResult};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread: Option<MessageIndex>,
    pub message_id: MessageId,
    pub update: MiniAppStatusUpdate,
}

pub type Response = UnitResult;
