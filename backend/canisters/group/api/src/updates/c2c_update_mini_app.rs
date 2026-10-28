use serde::{Deserialize, Serialize};
use types::{MessageId, MessageIndex, MiniAppUpdate, UnitResult};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread: Option<MessageIndex>,
    pub message_id: MessageId,
    pub update: MiniAppUpdate,
}

pub type Response = UnitResult;
