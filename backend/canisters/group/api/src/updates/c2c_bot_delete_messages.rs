use serde::{Deserialize, Serialize};
use types::{BotInitiator, MessageId, MessageIndex, UnitResult, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: BotInitiator,
    pub thread: Option<MessageIndex>,
    pub message_ids: Vec<MessageId>,
}

pub type Response = UnitResult;
