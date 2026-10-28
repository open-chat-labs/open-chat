use serde::{Deserialize, Serialize};
use types::{MessageId, MessageIndex, MiniAppStatus, UnitResult};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread: Option<MessageIndex>,
    pub message_id: MessageId,
    pub status: MiniAppStatus,
}

pub type Response = UnitResult;
